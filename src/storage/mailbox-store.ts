import type { Mailbox } from "../model/context-package.js";

// This interface is intentionally mailbox-only. Context Package persistence
// lands in a separate PR so the database surface stays easy to review.
export type MailboxStore = {
  createMailbox(name: string): Promise<Mailbox>;
  getMailbox(name: string): Promise<Mailbox | null>;
  listMailboxes(): Promise<Mailbox[]>;
  close(): void;
};
