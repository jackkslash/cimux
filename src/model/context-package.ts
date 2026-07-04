import { z } from "zod";

// A mailbox is addressed by the harness plus a local working name.
// Examples: codex/feature-login, claude/auth-repro, cursor/fix-nav.
export const mailboxNameSchema = z
  .string()
  .min(3)
  .max(140)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message: "Mailbox name must use harness/name format, for example codex/feature-checkout-ui"
  });

export const mailboxSchema = z.object({
  name: mailboxNameSchema,
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable()
});

// Artifacts are pointers that help the receiving agent find the relevant work.
// They are not meant to replace the full repository, diff, or external system.
export const fileArtifactSchema = z.object({
  path: z.string().min(1),
  repo: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  note: z.string().optional()
});

export const functionArtifactSchema = z.object({
  name: z.string().min(1),
  file: z.string().optional(),
  signature: z.string().optional(),
  note: z.string().optional()
});

export const commitArtifactSchema = z.object({
  sha: z.string().min(1),
  repo: z.string().optional(),
  message: z.string().optional()
});

export const pullRequestArtifactSchema = z.object({
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  title: z.string().optional()
});

export const urlArtifactSchema = z.object({
  url: z.string().url(),
  title: z.string().optional()
});

export const codeSnippetArtifactSchema = z.object({
  language: z.string().optional(),
  label: z.string().optional(),
  code: z.string().min(1)
});

export const artifactsSchema = z
  .object({
    files: z.array(fileArtifactSchema).default([]),
    functions: z.array(functionArtifactSchema).default([]),
    commits: z.array(commitArtifactSchema).default([]),
    pullRequests: z.array(pullRequestArtifactSchema).default([]),
    urls: z.array(urlArtifactSchema).default([]),
    codeSnippets: z.array(codeSnippetArtifactSchema).default([])
  })
  .default({});

// Ack means "the receiver saw or loaded this", not "the work is complete".
export const ackStateSchema = z.object({
  status: z.enum(["pending", "acknowledged"]),
  ackAt: z.string().datetime().nullable(),
  ackBy: mailboxNameSchema.nullable(),
  note: z.string().nullable()
});

// This is the shape a sender provides. Server-managed fields such as id,
// createdAt, readAt, and ack are added later by the storage/service layer.
export const createContextPackageInputSchema = z.object({
  fromMailbox: mailboxNameSchema,
  toMailbox: mailboxNameSchema,
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(4000),
  body: z.string().min(1),
  tags: z.array(z.string().min(1).max(80)).default([]),
  artifacts: artifactsSchema.default({}),
  payload: z.record(z.unknown()).default({})
});

// This is the durable object Cimux stores and returns from read_context.
export const contextPackageSchema = createContextPackageInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
  ack: ackStateSchema
});

// Inbox previews are deliberately smaller than full packages. They let an agent
// decide whether to call read_context without dumping body text, code snippets,
// artifact details, or payload values into context.
export const contextPackagePreviewSchema = z.object({
  id: z.string().min(1),
  fromMailbox: mailboxNameSchema,
  toMailbox: mailboxNameSchema,
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
  ack: ackStateSchema,
  artifactCounts: z.object({
    files: z.number().int().nonnegative(),
    functions: z.number().int().nonnegative(),
    commits: z.number().int().nonnegative(),
    pullRequests: z.number().int().nonnegative(),
    urls: z.number().int().nonnegative(),
    codeSnippets: z.number().int().nonnegative()
  }),
  payloadKeys: z.array(z.string())
});

// Types are inferred from the Zod schemas so runtime validation and TypeScript
// compile-time types cannot drift apart.
export type MailboxName = z.infer<typeof mailboxNameSchema>;
export type Mailbox = z.infer<typeof mailboxSchema>;
export type FileArtifact = z.infer<typeof fileArtifactSchema>;
export type FunctionArtifact = z.infer<typeof functionArtifactSchema>;
export type CommitArtifact = z.infer<typeof commitArtifactSchema>;
export type PullRequestArtifact = z.infer<typeof pullRequestArtifactSchema>;
export type UrlArtifact = z.infer<typeof urlArtifactSchema>;
export type CodeSnippetArtifact = z.infer<typeof codeSnippetArtifactSchema>;
export type Artifacts = z.infer<typeof artifactsSchema>;
export type AckState = z.infer<typeof ackStateSchema>;
export type CreateContextPackageInput = z.input<typeof createContextPackageInputSchema>;
export type NormalizedCreateContextPackageInput = z.output<
  typeof createContextPackageInputSchema
>;
export type ContextPackage = z.infer<typeof contextPackageSchema>;
export type ContextPackagePreview = z.infer<typeof contextPackagePreviewSchema>;
