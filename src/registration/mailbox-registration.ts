import { mailboxNameSchema } from "../model/context-package.js";
import type { Mailbox } from "../model/context-package.js";
import type { MailboxStore } from "../storage/mailbox-store.js";

export type RegisterMailboxInput = {
  harness: string;
  explicitMailbox?: string;
  branchName?: string;
  taskName?: string;
  folderName?: string;
};

export type RegisterMailboxResult = {
  mailbox: Mailbox;
  mailboxes: Mailbox[];
  inferred: boolean;
};

export async function registerMailbox(
  store: MailboxStore,
  input: RegisterMailboxInput
): Promise<RegisterMailboxResult> {
  const inferredName = inferMailboxName(input);
  const mailbox = await store.createMailbox(inferredName);
  const mailboxes = await store.listMailboxes();

  return {
    mailbox,
    mailboxes,
    inferred: !input.explicitMailbox
  };
}

export function inferMailboxName(input: RegisterMailboxInput): string {
  if (input.explicitMailbox) {
    return mailboxNameSchema.parse(input.explicitMailbox);
  }

  const harness = slugify(input.harness);
  const localName =
    // Branch is preferred because it usually maps to the actual workstream.
    slugify(input.branchName) ||
    // Task names are useful when there is no branch yet.
    slugify(input.taskName) ||
    // Folder name is the final stable local fallback.
    slugify(input.folderName) ||
    "default";

  return mailboxNameSchema.parse(`${harness}/${localName}`);
}

function slugify(value?: string): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .slice(0, 80);
}
