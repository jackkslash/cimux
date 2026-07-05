#!/usr/bin/env node
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { runCimuxCli } from "./cli/cimux-cli.js";
import { name } from "./version.js";

export { name, version } from "./version.js";

export function getProjectStage(): string {
  return "local-mvp";
}

export type {
  AckState,
  Artifacts,
  CodeSnippetArtifact,
  CommitArtifact,
  ContextPackage,
  ContextPackagePreview,
  CreateContextPackageInput,
  FileArtifact,
  FunctionArtifact,
  Mailbox,
  MailboxName,
  NormalizedCreateContextPackageInput,
  PullRequestArtifact,
  UrlArtifact
} from "./model/context-package.js";
export type {
  AckContextPackageOptions,
  ContextPackageStore,
  ListInboxPreviewsOptions,
  MailboxStore
} from "./storage/mailbox-store.js";
export type {
  RegisterMailboxInput,
  RegisterMailboxResult
} from "./registration/mailbox-registration.js";

export {
  ackStateSchema,
  artifactsSchema,
  codeSnippetArtifactSchema,
  commitArtifactSchema,
  contextPackagePreviewSchema,
  contextPackageSchema,
  createContextPackagePreview,
  createContextPackageInputSchema,
  DEFAULT_INBOX_PREVIEW_LIMIT,
  fileArtifactSchema,
  functionArtifactSchema,
  MAX_INBOX_PREVIEW_LIMIT,
  mailboxNameSchema,
  mailboxSchema,
  normalizeInboxPreviewLimit,
  PREVIEW_SUMMARY_MAX_LENGTH,
  PREVIEW_TAG_MAX_COUNT,
  PREVIEW_TITLE_MAX_LENGTH,
  pullRequestArtifactSchema,
  urlArtifactSchema
} from "./model/context-package.js";
export {
  ackContext,
  checkInbox,
  ContextPackageNotFoundError,
  createInboxNotification,
  MailboxAccessError,
  readContext,
  registerSession,
  sendContext
} from "./service/cimux-mailbox-service.js";
export { runCimuxCli } from "./cli/cimux-cli.js";
export { applyInstallPlan, createInstallPlan } from "./install/cimux-install-plan.js";
export {
  createCimuxMcpServer,
  defaultDatabasePath,
  runCimuxMcpServer
} from "./mcp/cimux-mcp-server.js";
export { resolveRuntimeMailbox } from "./runtime/mailbox-runtime.js";
export {
  inferMailboxName,
  registerMailboxInputSchema,
  registerMailbox
} from "./registration/mailbox-registration.js";
export { SQLiteCimuxStore, UnknownMailboxError } from "./storage/sqlite-cimux-store.js";

if (isCliEntrypoint()) {
  process.exitCode = await runCimuxCli(process.argv.slice(2));
}

export function isCliEntrypoint(
  argvPath = process.argv[1],
  modulePath = fileURLToPath(import.meta.url)
): boolean {
  if (!argvPath) {
    return false;
  }

  // npm link and global installs usually invoke the bin through a symlink.
  // Compare real paths so the published command still reaches runCimuxCli.
  return fs.realpathSync(argvPath) === fs.realpathSync(modulePath);
}
