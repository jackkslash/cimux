import { execFileSync } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { inferMailboxName } from "../registration/mailbox-registration.js";
import { mailboxNameSchema } from "../model/context-package.js";

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

