import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  contextPackageSchema,
  mailboxNameSchema,
  mailboxSchema
} from "../model/context-package.js";
import type {
  AckState,
  Artifacts,
  ContextPackage,
  Mailbox
} from "../model/context-package.js";
import type {
  AckContextPackageOptions,
  ContextPackageStore,
  MailboxStore
} from "./mailbox-store.js";

type MailboxRow = {
  name: string;
  created_at: string;
  last_seen_at: string | null;
};

type ContextPackageRow = {
  id: string;
  from_mailbox: string;
  to_mailbox: string;
  title: string;
  summary: string;
  body: string;
  tags_json: string;
  artifacts_json: string;
  payload_json: string;
  created_at: string;
  read_at: string | null;
  ack_json: string;
};

export class SQLiteCimuxStore implements MailboxStore, ContextPackageStore {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    // The caller decides where the local Cimux database lives. Production code
    // will point this at ~/.cimux/inbox.sqlite; tests can use a temp path.
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec("pragma foreign_keys = ON;");
    this.migrate();
  }

  async createMailbox(name: string): Promise<Mailbox> {
    const parsedName = mailboxNameSchema.parse(name);
    const now = new Date().toISOString();

    // Creating a mailbox is idempotent so repeated session registration can
    // safely call this without resetting the durable mailbox record.
    this.db
      .prepare(
        `insert into mailboxes (name, created_at, last_seen_at)
         values (?, ?, null)
         on conflict(name) do nothing`
      )
      .run(parsedName, now);

    const mailbox = await this.getMailbox(parsedName);
    if (!mailbox) {
      throw new Error(`Mailbox was not created: ${parsedName}`);
    }

    return mailbox;
  }

  async getMailbox(name: string): Promise<Mailbox | null> {
    const parsedName = mailboxNameSchema.parse(name);
    const row = this.db
      .prepare("select name, created_at, last_seen_at from mailboxes where name = ?")
      .get(parsedName) as MailboxRow | undefined;

    return row ? toMailbox(row) : null;
  }

  async listMailboxes(): Promise<Mailbox[]> {
    const rows = this.db
      .prepare("select name, created_at, last_seen_at from mailboxes order by name asc")
      .all() as MailboxRow[];

    return rows.map(toMailbox);
  }

  async createContextPackage(contextPackage: ContextPackage): Promise<ContextPackage> {
    const parsed = contextPackageSchema.parse(contextPackage);

    await this.assertMailboxExists(parsed.fromMailbox);
    await this.assertMailboxExists(parsed.toMailbox);

    this.db
      .prepare(
        `insert into context_packages (
          id,
          from_mailbox,
          to_mailbox,
          title,
          summary,
          body,
          tags_json,
          artifacts_json,
          payload_json,
          created_at,
          read_at,
          ack_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.id,
        parsed.fromMailbox,
        parsed.toMailbox,
        parsed.title,
        parsed.summary,
        parsed.body,
        JSON.stringify(parsed.tags),
        JSON.stringify(parsed.artifacts),
        JSON.stringify(parsed.payload),
        parsed.createdAt,
        parsed.readAt,
        JSON.stringify(parsed.ack)
      );

    return parsed;
  }

  async readContextPackage(id: string): Promise<ContextPackage | null> {
    const contextPackage = await this.getContextPackage(id);
    if (!contextPackage) {
      return null;
    }

    if (contextPackage.readAt) {
      return contextPackage;
    }

    const readAt = new Date().toISOString();
    this.db
      .prepare("update context_packages set read_at = ? where id = ?")
      .run(readAt, contextPackage.id);

    return {
      ...contextPackage,
      readAt
    };
  }

  async ackContextPackage(
    id: string,
    options: AckContextPackageOptions
  ): Promise<ContextPackage | null> {
    const contextPackage = await this.getContextPackage(id);
    if (!contextPackage) {
      return null;
    }

    const ackBy = mailboxNameSchema.parse(options.ackBy);
    const ack: AckState = {
      status: "acknowledged",
      ackAt: new Date().toISOString(),
      ackBy,
      note: options.note ?? null
    };

    this.db
      .prepare("update context_packages set ack_json = ? where id = ?")
      .run(JSON.stringify(ack), id);

    return {
      ...contextPackage,
      ack
    };
  }

  close(): void {
    this.db.close();
  }

  private async assertMailboxExists(name: string): Promise<void> {
    const mailbox = await this.getMailbox(name);
    if (!mailbox) {
      throw new UnknownMailboxError(name);
    }
  }

  private async getContextPackage(id: string): Promise<ContextPackage | null> {
    const row = this.db
      .prepare("select * from context_packages where id = ?")
      .get(id) as ContextPackageRow | undefined;

    return row ? toContextPackage(row) : null;
  }

  private migrate(): void {
    // Context Packages reference mailboxes by name. Unknown recipients are
    // rejected at storage time instead of being silently auto-created.
    this.db.exec(`
      create table if not exists mailboxes (
        name text primary key,
        created_at text not null,
        last_seen_at text
      );

      create table if not exists context_packages (
        id text primary key,
        from_mailbox text not null references mailboxes(name),
        to_mailbox text not null references mailboxes(name),
        title text not null,
        summary text not null,
        body text not null,
        tags_json text not null,
        artifacts_json text not null,
        payload_json text not null,
        created_at text not null,
        read_at text,
        ack_json text not null
      );

      create index if not exists idx_context_packages_id
        on context_packages (id);
    `);
  }
}

export class UnknownMailboxError extends Error {
  constructor(readonly mailboxName: string) {
    super(`Unknown mailbox: ${mailboxName}`);
    this.name = "UnknownMailboxError";
  }
}

function toMailbox(row: MailboxRow): Mailbox {
  // Validate rows on the way out so database changes cannot silently drift
  // away from the public model contract.
  return mailboxSchema.parse({
    name: row.name,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  });
}

function toContextPackage(row: ContextPackageRow): ContextPackage {
  return contextPackageSchema.parse({
    id: row.id,
    fromMailbox: row.from_mailbox,
    toMailbox: row.to_mailbox,
    title: row.title,
    summary: row.summary,
    body: row.body,
    tags: JSON.parse(row.tags_json) as string[],
    artifacts: JSON.parse(row.artifacts_json) as Artifacts,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    createdAt: row.created_at,
    readAt: row.read_at,
    ack: JSON.parse(row.ack_json) as AckState
  });
}
