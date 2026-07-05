import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  contextPackageSchema,
  createContextPackageInputSchema,
  mailboxNameSchema
} from "../model/context-package.js";
import type {
  ContextPackage,
  ContextPackagePreview,
  CreateContextPackageInput,
  Mailbox
} from "../model/context-package.js";
import {
  registerMailbox,
  type RegisterMailboxInput,
  type RegisterMailboxResult
} from "../registration/mailbox-registration.js";
import type { ContextPackageStore, MailboxStore } from "../storage/mailbox-store.js";

export const checkInboxInputSchema = z.object({
  mailbox: mailboxNameSchema,
  unreadOnly: z.boolean().default(true),
  limit: z.number().int().positive().optional()
});

export const readContextInputSchema = z.object({
  mailbox: mailboxNameSchema,
  id: z.string().min(1)
});

export const ackContextInputSchema = readContextInputSchema.extend({
  note: z.string().max(1000).optional()
});

export type CimuxStore = MailboxStore & ContextPackageStore;
export type CheckInboxInput = z.input<typeof checkInboxInputSchema>;
export type ReadContextInput = z.input<typeof readContextInputSchema>;
export type AckContextInput = z.input<typeof ackContextInputSchema>;

export type SendContextResult = {
  contextPackage: ContextPackage;
};

export type CheckInboxResult = {
  mailbox: string;
  previews: ContextPackagePreview[];
};

export type ReadContextResult = {
  contextPackage: ContextPackage;
};

export type AckContextResult = {
  contextPackage: ContextPackage;
};

export class MailboxAccessError extends Error {
  constructor(readonly mailbox: string, readonly contextPackageId: string) {
    super(`Context Package ${contextPackageId} is not addressed to ${mailbox}`);
    this.name = "MailboxAccessError";
  }
}

export class ContextPackageNotFoundError extends Error {
  constructor(readonly contextPackageId: string) {
    super(`Unknown Context Package: ${contextPackageId}`);
    this.name = "ContextPackageNotFoundError";
  }
}

export async function registerSession(
  store: MailboxStore,
  input: RegisterMailboxInput
): Promise<RegisterMailboxResult> {
  return registerMailbox(store, input);
}

export async function sendContext(
  store: CimuxStore,
  input: CreateContextPackageInput
): Promise<SendContextResult> {
  const parsed = createContextPackageInputSchema.parse(input);

  // The sender supplies the handoff content. Cimux adds the durable bookkeeping
  // fields so every stored package has consistent read/ack state.
  const contextPackage = contextPackageSchema.parse({
    ...parsed,
    id: createContextPackageId(),
    createdAt: new Date().toISOString(),
    readAt: null,
    ack: {
      status: "pending",
      ackAt: null,
      ackBy: null,
      note: null
    }
  });

  return {
    contextPackage: await store.createContextPackage(contextPackage)
  };
}

export async function checkInbox(
  store: CimuxStore,
  input: CheckInboxInput
): Promise<CheckInboxResult> {
  const parsed = checkInboxInputSchema.parse(input);

  return {
    mailbox: parsed.mailbox,
    previews: await store.listInboxPreviews(parsed.mailbox, {
      unreadOnly: parsed.unreadOnly,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit })
    })
  };
}

export async function readContext(
  store: CimuxStore,
  input: ReadContextInput
): Promise<ReadContextResult> {
  const parsed = readContextInputSchema.parse(input);
  await assertPackageBelongsToMailbox(store, parsed.id, parsed.mailbox);

  const contextPackage = await store.readContextPackage(parsed.id);
  if (!contextPackage) {
    throw new ContextPackageNotFoundError(parsed.id);
  }

  return { contextPackage };
}

export async function ackContext(
  store: CimuxStore,
  input: AckContextInput
): Promise<AckContextResult> {
  const parsed = ackContextInputSchema.parse(input);
  await assertPackageBelongsToMailbox(store, parsed.id, parsed.mailbox);

  const contextPackage = await store.ackContextPackage(parsed.id, {
    ackBy: parsed.mailbox,
    ...(parsed.note === undefined ? {} : { note: parsed.note })
  });
  if (!contextPackage) {
    throw new ContextPackageNotFoundError(parsed.id);
  }

  return { contextPackage };
}

async function assertPackageBelongsToMailbox(
  store: CimuxStore,
  id: string,
  mailbox: string
): Promise<void> {
  const contextPackage = await store.getContextPackage(id);
  if (!contextPackage) {
    throw new ContextPackageNotFoundError(id);
  }

  // This is the local privacy boundary for the MCP tools: anyone may send to a
  // mailbox, but reading and acknowledging require naming the recipient mailbox.
  if (contextPackage.toMailbox !== mailbox) {
    throw new MailboxAccessError(mailbox, id);
  }
}

function createContextPackageId(): string {
  return `ctx_${randomUUID()}`;
}
