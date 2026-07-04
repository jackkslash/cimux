import { describe, expect, it } from "vitest";
import {
  contextPackagePreviewSchema,
  contextPackageSchema,
  createContextPackageInputSchema,
  mailboxNameSchema
} from "../src/index.js";

describe("Context Package model", () => {
  it("accepts harness/name mailbox names", () => {
    expect(mailboxNameSchema.parse("codex/feature-checkout-ui")).toBe(
      "codex/feature-checkout-ui"
    );
    expect(mailboxNameSchema.parse("claude/auth_repro")).toBe("claude/auth_repro");
    expect(mailboxNameSchema.parse("cursor.fix/login-redirect")).toBe(
      "cursor.fix/login-redirect"
    );
  });

  it("rejects mailbox names outside harness/name format", () => {
    expect(() => mailboxNameSchema.parse("frontend")).toThrow();
    expect(() => mailboxNameSchema.parse("/frontend")).toThrow();
    expect(() => mailboxNameSchema.parse("codex/")).toThrow();
    expect(() => mailboxNameSchema.parse("codex/frontend/work")).toThrow();
  });

  it("normalizes optional package fields", () => {
    const parsed = createContextPackageInputSchema.parse({
      fromMailbox: "codex/backend",
      toMailbox: "claude/frontend",
      title: "Auth change",
      summary: "Frontend should handle a changed auth failure.",
      body: "validateSession now throws ExpiredSessionError."
    });

    expect(parsed.tags).toEqual([]);
    expect(parsed.artifacts.files).toEqual([]);
    expect(parsed.artifacts.functions).toEqual([]);
    expect(parsed.artifacts.commits).toEqual([]);
    expect(parsed.artifacts.pullRequests).toEqual([]);
    expect(parsed.artifacts.urls).toEqual([]);
    expect(parsed.artifacts.codeSnippets).toEqual([]);
    expect(parsed.payload).toEqual({});
  });

  it("validates the full Context Package shape", () => {
    const parsed = contextPackageSchema.parse({
      id: "ctx_001",
      fromMailbox: "codex/backend",
      toMailbox: "claude/frontend",
      title: "Auth change",
      summary: "Frontend should handle a changed auth failure.",
      body: "validateSession now throws ExpiredSessionError.",
      tags: ["auth"],
      artifacts: {
        files: [{ path: "src/auth/session.ts", lineStart: 42 }],
        functions: [{ name: "validateSession", file: "src/auth/session.ts" }],
        commits: [{ sha: "abc123", message: "Change auth failure" }],
        pullRequests: [{ id: "12", title: "Auth change" }],
        urls: [{ url: "https://example.com/auth-change" }],
        codeSnippets: [{ language: "ts", code: "throw new ExpiredSessionError();" }]
      },
      payload: { errorName: "ExpiredSessionError" },
      createdAt: "2026-07-04T00:00:00.000Z",
      readAt: null,
      ack: {
        status: "pending",
        ackAt: null,
        ackBy: null,
        note: null
      }
    });

    expect(parsed.ack.status).toBe("pending");
    expect(parsed.artifacts.codeSnippets).toHaveLength(1);
  });

  it("defines previews without body, artifact bodies, or payload values", () => {
    const preview = contextPackagePreviewSchema.parse({
      id: "ctx_001",
      fromMailbox: "codex/backend",
      toMailbox: "claude/frontend",
      title: "Auth change",
      summary: "Frontend should handle a changed auth failure.",
      tags: ["auth"],
      createdAt: "2026-07-04T00:00:00.000Z",
      readAt: null,
      ack: {
        status: "pending",
        ackAt: null,
        ackBy: null,
        note: null
      },
      artifactCounts: {
        files: 1,
        functions: 1,
        commits: 1,
        pullRequests: 1,
        urls: 1,
        codeSnippets: 1
      },
      payloadKeys: ["errorName"]
    });

    expect(preview).not.toHaveProperty("body");
    expect(JSON.stringify(preview)).not.toContain("ExpiredSessionError");
  });
});
