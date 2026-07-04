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
  MailboxName,
  NormalizedCreateContextPackageInput,
  PullRequestArtifact,
  UrlArtifact
} from "./model/context-package.js";

export {
  ackStateSchema,
  artifactsSchema,
  codeSnippetArtifactSchema,
  commitArtifactSchema,
  contextPackagePreviewSchema,
  contextPackageSchema,
  createContextPackageInputSchema,
  fileArtifactSchema,
  functionArtifactSchema,
  mailboxNameSchema,
  pullRequestArtifactSchema,
  urlArtifactSchema
} from "./model/context-package.js";
