import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { mailboxNameSchema, mailboxSchema } from "../model/context-package.js";
import type { Mailbox } from "../model/context-package.js";
import type { MailboxStore } from "./mailbox-store.js";

type MailboxRow = {
  name: string;
  created_at: string;
  last_seen_at: string | null;
};

export class SQLiteMailboxStore implements MailboxStore {
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

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    // Keep the first migration tiny: named durable mailboxes only. Message
    // tables and indexes are added when Context Package persistence lands.
    this.db.exec(`
      create table if not exists mailboxes (
        name text primary key,
        created_at text not null,
        last_seen_at text
      );
    `);
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
