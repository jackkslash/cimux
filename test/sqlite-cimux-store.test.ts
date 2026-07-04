import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  contextPackageSchema,
  MAX_INBOX_PREVIEW_LIMIT,
  PREVIEW_SUMMARY_MAX_LENGTH,
  PREVIEW_TAG_MAX_COUNT,
  PREVIEW_TITLE_MAX_LENGTH,
  SQLiteCimuxStore,
  UnknownMailboxError
} from "../src/index.js";
import type { ContextPackage } from "../src/index.js";

let tempDir: string;
let store: SQLiteCimuxStore;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-mailboxes-"));
  store = new SQLiteCimuxStore(path.join(tempDir, "inbox.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SQLiteCimuxStore mailboxes", () => {
  it("creates a mailbox", async () => {
    const mailbox = await store.createMailbox("codex/backend-auth");

    expect(mailbox.name).toBe("codex/backend-auth");
    expect(mailbox.createdAt).toEqual(expect.any(String));
    expect(mailbox.lastSeenAt).toBeNull();
  });

  it("returns an existing mailbox", async () => {
    await store.createMailbox("claude/frontend-login");

    const mailbox = await store.getMailbox("claude/frontend-login");

    expect(mailbox?.name).toBe("claude/frontend-login");
  });

  it("returns null for a missing mailbox", async () => {
    await expect(store.getMailbox("codex/missing")).resolves.toBeNull();
  });

  it("lists mailboxes alphabetically", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");
    await store.createMailbox("cursor/repro-case");

    const mailboxes = await store.listMailboxes();

    expect(mailboxes.map((mailbox) => mailbox.name)).toEqual([
      "claude/frontend-login",
      "codex/backend-auth",
      "cursor/repro-case"
    ]);
  });

  it("is idempotent when creating an existing mailbox", async () => {
    const first = await store.createMailbox("codex/backend-auth");
    const second = await store.createMailbox("codex/backend-auth");

    expect(second).toEqual(first);
    await expect(store.listMailboxes()).resolves.toHaveLength(1);
  });

  it("rejects invalid mailbox names before writing", async () => {
    await expect(store.createMailbox("backend-auth")).rejects.toThrow();
    await expect(store.listMailboxes()).resolves.toHaveLength(0);
  });
});

describe("SQLiteCimuxStore Context Packages", () => {
  it("creates and reads a Context Package", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");

    await store.createContextPackage(
      contextPackageSchema.parse({
        id: "ctx_001",
        fromMailbox: "codex/backend-auth",
        toMailbox: "claude/frontend-login",
        title: "Auth session error changed",
        summary: "Frontend should handle ExpiredSessionError.",
        body: "validateSession now throws ExpiredSessionError instead of returning null.",
        tags: ["auth", "frontend"],
        artifacts: {
          files: [{ path: "src/auth/session.ts" }]
        },
        payload: {
          errorName: "ExpiredSessionError"
        },
        createdAt: "2026-07-04T00:00:00.000Z",
        readAt: null,
        ack: {
          status: "pending",
          ackAt: null,
          ackBy: null,
          note: null
        }
      })
    );

    const read = await store.readContextPackage("ctx_001");

    expect(read?.id).toBe("ctx_001");
    expect(read?.body).toContain("ExpiredSessionError");
    expect(read?.readAt).toEqual(expect.any(String));
  });

  it("sets readAt only on first read", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");
    await store.createContextPackage(makeContextPackage("ctx_read_once"));

    const firstRead = await store.readContextPackage("ctx_read_once");
    const secondRead = await store.readContextPackage("ctx_read_once");

    expect(firstRead?.readAt).toEqual(expect.any(String));
    expect(secondRead?.readAt).toBe(firstRead?.readAt);
  });

  it("acknowledges a Context Package", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");
    await store.createContextPackage(makeContextPackage("ctx_ack"));

    const acknowledged = await store.ackContextPackage("ctx_ack", {
      ackBy: "claude/frontend-login",
      note: "Loaded into context."
    });

    expect(acknowledged?.ack.status).toBe("acknowledged");
    expect(acknowledged?.ack.ackBy).toBe("claude/frontend-login");
    expect(acknowledged?.ack.ackAt).toEqual(expect.any(String));
    expect(acknowledged?.ack.note).toBe("Loaded into context.");
  });

  it("returns null when reading or acking a missing package", async () => {
    await expect(store.readContextPackage("ctx_missing")).resolves.toBeNull();
    await expect(
      store.ackContextPackage("ctx_missing", { ackBy: "claude/frontend-login" })
    ).resolves.toBeNull();
  });

  it("rejects unknown sender or recipient mailboxes", async () => {
    await store.createMailbox("codex/backend-auth");

    await expect(
      store.createContextPackage(makeContextPackage("ctx_unknown_to"))
    ).rejects.toBeInstanceOf(UnknownMailboxError);

    await store.createMailbox("claude/frontend-login");

    await expect(
      store.createContextPackage({
        ...makeContextPackage("ctx_unknown_from"),
        fromMailbox: "codex/missing"
      })
    ).rejects.toBeInstanceOf(UnknownMailboxError);
  });
});

describe("SQLiteCimuxStore inbox previews", () => {
  it("lists token-aware inbox previews without full package content", async () => {
    await createDefaultMailboxes();
    const longTitle = "T".repeat(PREVIEW_TITLE_MAX_LENGTH + 20);
    const longSummary = "S".repeat(PREVIEW_SUMMARY_MAX_LENGTH + 20);

    await store.createContextPackage(
      makeContextPackage("ctx_preview", {
        title: longTitle,
        summary: longSummary,
        body: "FULL_BODY_SHOULD_NOT_APPEAR",
        tags: ["one", "two", "three", "four", "five", "six"],
        artifacts: {
          files: [{ path: "src/auth/session.ts" }],
          functions: [{ name: "validateSession" }],
          commits: [{ sha: "abc123" }],
          pullRequests: [{ id: "12" }],
          urls: [{ url: "https://example.com/auth" }],
          codeSnippets: [{ language: "ts", code: "SECRET_SNIPPET_SHOULD_NOT_APPEAR" }]
        },
        payload: {
          exposedKey: "SECRET_PAYLOAD_VALUE_SHOULD_NOT_APPEAR"
        }
      })
    );

    const previews = await store.listInboxPreviews("claude/frontend-login");
    const serialized = JSON.stringify(previews);

    expect(previews).toHaveLength(1);
    expect(previews[0]?.title).toHaveLength(PREVIEW_TITLE_MAX_LENGTH);
    expect(previews[0]?.summary).toHaveLength(PREVIEW_SUMMARY_MAX_LENGTH);
    expect(previews[0]?.tags).toHaveLength(PREVIEW_TAG_MAX_COUNT);
    expect(previews[0]?.artifactCounts).toEqual({
      files: 1,
      functions: 1,
      commits: 1,
      pullRequests: 1,
      urls: 1,
      codeSnippets: 1
    });
    expect(previews[0]?.payloadKeys).toEqual(["exposedKey"]);
    expect(serialized).not.toContain("FULL_BODY_SHOULD_NOT_APPEAR");
    expect(serialized).not.toContain("SECRET_SNIPPET_SHOULD_NOT_APPEAR");
    expect(serialized).not.toContain("SECRET_PAYLOAD_VALUE_SHOULD_NOT_APPEAR");
  });

  it("lists newest inbox previews first", async () => {
    await createDefaultMailboxes();
    await store.createContextPackage(
      makeContextPackage("ctx_old", { createdAt: "2026-07-04T00:00:00.000Z" })
    );
    await store.createContextPackage(
      makeContextPackage("ctx_new", { createdAt: "2026-07-04T01:00:00.000Z" })
    );

    const previews = await store.listInboxPreviews("claude/frontend-login");

    expect(previews.map((preview) => preview.id)).toEqual(["ctx_new", "ctx_old"]);
  });

  it("can list unread previews only", async () => {
    await createDefaultMailboxes();
    await store.createContextPackage(makeContextPackage("ctx_unread"));
    await store.createContextPackage(
      makeContextPackage("ctx_read", { readAt: "2026-07-04T01:00:00.000Z" })
    );

    const previews = await store.listInboxPreviews("claude/frontend-login", {
      unreadOnly: true
    });

    expect(previews.map((preview) => preview.id)).toEqual(["ctx_unread"]);
  });

  it("caps preview limits", async () => {
    await createDefaultMailboxes();

    for (let index = 0; index < MAX_INBOX_PREVIEW_LIMIT + 5; index += 1) {
      await store.createContextPackage(
        makeContextPackage(`ctx_${index.toString().padStart(2, "0")}`, {
          createdAt: `2026-07-04T00:${index.toString().padStart(2, "0")}:00.000Z`
        })
      );
    }

    const previews = await store.listInboxPreviews("claude/frontend-login", {
      limit: MAX_INBOX_PREVIEW_LIMIT + 100
    });

    expect(previews).toHaveLength(MAX_INBOX_PREVIEW_LIMIT);
  });

  it("does not return previews for other mailboxes", async () => {
    await createDefaultMailboxes();
    await store.createMailbox("claude/other-task");
    await store.createContextPackage(makeContextPackage("ctx_frontend"));
    await store.createContextPackage(
      makeContextPackage("ctx_other", { toMailbox: "claude/other-task" })
    );

    const previews = await store.listInboxPreviews("claude/frontend-login");

    expect(previews.map((preview) => preview.id)).toEqual(["ctx_frontend"]);
  });
});

async function createDefaultMailboxes(): Promise<void> {
  await store.createMailbox("codex/backend-auth");
  await store.createMailbox("claude/frontend-login");
}

function makeContextPackage(
  id: string,
  overrides: Partial<ContextPackage> = {}
): ContextPackage {
  return contextPackageSchema.parse({
    id,
    fromMailbox: "codex/backend-auth",
    toMailbox: "claude/frontend-login",
    title: "Auth session error changed",
    summary: "Frontend should handle ExpiredSessionError.",
    body: "validateSession now throws ExpiredSessionError instead of returning null.",
    tags: ["auth", "frontend"],
    artifacts: {},
    payload: {},
    createdAt: "2026-07-04T00:00:00.000Z",
    readAt: null,
    ack: {
      status: "pending",
      ackAt: null,
      ackBy: null,
      note: null
    },
    ...overrides
  });
}
