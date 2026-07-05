#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { runCimuxMcpServer } from "./mcp/cimux-mcp-server.js";

export const name = "cimux";
export const version = "0.1.0";

export function getProjectStage(): string {
  return "scaffold";
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
  MailboxAccessError,
  readContext,
  registerSession,
  sendContext
} from "./service/cimux-mailbox-service.js";
export {
  createCimuxMcpServer,
  defaultDatabasePath,
  runCimuxMcpServer
} from "./mcp/cimux-mcp-server.js";
export {
  inferMailboxName,
  registerMailboxInputSchema,
  registerMailbox
} from "./registration/mailbox-registration.js";
export { SQLiteCimuxStore, UnknownMailboxError } from "./storage/sqlite-cimux-store.js";

if (isCliEntrypoint()) {
  const command = process.argv[2];

  if (command === "mcp") {
    await runCimuxMcpServer(process.env.CIMUX_DB_PATH);
  } else {
    console.error("Usage: cimux mcp");
    process.exitCode = 1;
  }
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}
