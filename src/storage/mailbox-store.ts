import type {
  ContextPackage,
  ContextPackagePreview,
  Mailbox
} from "../model/context-package.js";

// This interface is intentionally mailbox-only. Context Package persistence
// lands in a separate PR so the database surface stays easy to review.
export type MailboxStore = {
  createMailbox(name: string): Promise<Mailbox>;
  getMailbox(name: string): Promise<Mailbox | null>;
  listMailboxes(): Promise<Mailbox[]>;
  close(): void;
};

export type AckContextPackageOptions = {
  ackBy: string;
  note?: string;
};

export type ListInboxPreviewsOptions = {
  unreadOnly?: boolean;
  limit?: number;
};

export type ContextPackageStore = {
  createContextPackage(contextPackage: ContextPackage): Promise<ContextPackage>;
  listInboxPreviews(
    mailboxName: string,
    options?: ListInboxPreviewsOptions
  ): Promise<ContextPackagePreview[]>;
  readContextPackage(id: string): Promise<ContextPackage | null>;
  ackContextPackage(
    id: string,
    options: AckContextPackageOptions
  ): Promise<ContextPackage | null>;
};
