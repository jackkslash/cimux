import { execFileSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { mailboxNameSchema } from "../model/context-package.js";
import type { Mailbox } from "../model/context-package.js";
import type { MailboxStore } from "../storage/mailbox-store.js";

// This module answers one question: what is this session's mailbox called?
// Explicit names win, then git branch, then task name, then folder name.

export const registerMailboxInputSchema = z.object({
  harness: z.string().min(1),
  explicitMailbox: mailboxNameSchema.optional(),
  branchName: z.string().min(1).optional(),
  taskName: z.string().min(1).optional(),
  folderName: z.string().min(1).optional()
});

export type RegisterMailboxInput = z.input<typeof registerMailboxInputSchema>;

export type RegisterMailboxResult = {
  mailbox: Mailbox;
  mailboxes: Mailbox[];
  inferred: boolean;
};

export const runtimeMailboxInputSchema = z.object({
  harness: z.string().min(1).optional(),
  explicitMailbox: mailboxNameSchema.optional(),
  cwd: z.string().min(1).default(process.cwd())
});

export type RuntimeMailboxInput = z.input<typeof runtimeMailboxInputSchema>;

export type RuntimeMailboxResult = {
  mailbox: string;
  inferredFrom: "explicit" | "branch" | "folder";
  branchName: string | null;
  folderName: string;
};

export async function registerMailbox(
  store: MailboxStore,
  input: RegisterMailboxInput
): Promise<RegisterMailboxResult> {
  const parsed = registerMailboxInputSchema.parse(input);
  const inferredName = inferMailboxName(parsed);
  const mailbox = await store.createMailbox(inferredName);
  const mailboxes = await store.listMailboxes();

  return {
    mailbox,
    mailboxes,
    inferred: !parsed.explicitMailbox
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

export function resolveRuntimeMailbox(input: RuntimeMailboxInput = {}): RuntimeMailboxResult {
  const parsed = runtimeMailboxInputSchema.parse(input);
  const folderName = path.basename(parsed.cwd);

  if (parsed.explicitMailbox) {
    return {
      mailbox: parsed.explicitMailbox,
      inferredFrom: "explicit",
      branchName: null,
      folderName
    };
  }

  const branchName = readGitBranch(parsed.cwd);
  const mailbox = inferMailboxName({
    harness: parsed.harness ?? "codex",
    branchName: branchName ?? undefined,
    folderName
  });

  return {
    mailbox,
    inferredFrom: branchName ? "branch" : "folder",
    branchName,
    folderName
  };
}

function readGitBranch(cwd: string): string | null {
  try {
    // Hooks run from the active session cwd. Asking git directly keeps mailbox
    // naming aligned with the real workstream without requiring user setup.
    const output = execFileSync("git", ["branch", "--show-current"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    return output || null;
  } catch {
    return null;
  }
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
