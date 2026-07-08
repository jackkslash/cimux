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
} from "./naming/mailbox-naming.js";

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
  createSessionBrief,
  listMailboxes,
  MailboxAccessError,
  readContext,
  registerSession,
  sendContext
} from "./service/cimux-mailbox-service.js";
export { runCimuxCli } from "./cli/cimux-cli.js";
export { applyInstallPlan, createInstallPlan } from "./install/cimux-install-plan.js";
export {
  detectInstalledHarnesses,
  SUPPORTED_HARNESSES
} from "./install/harnesses/index.js";
export type { HarnessName } from "./install/harnesses/index.js";
export {
  createCimuxMcpServer,
  defaultDatabasePath,
  runCimuxMcpServer
} from "./mcp/cimux-mcp-server.js";
export {
  inferMailboxName,
  registerMailbox,
  registerMailboxInputSchema,
  resolveRuntimeMailbox
} from "./naming/mailbox-naming.js";
export { SQLiteCimuxStore, UnknownMailboxError } from "./storage/sqlite-cimux-store.js";
