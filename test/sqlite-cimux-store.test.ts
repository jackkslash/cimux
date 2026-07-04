import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contextPackageSchema, SQLiteCimuxStore, UnknownMailboxError } from "../src/index.js";

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

function makeContextPackage(id: string) {
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
    }
  });
}
