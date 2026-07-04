import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteMailboxStore } from "../src/index.js";

let tempDir: string;
let store: SQLiteMailboxStore;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-mailboxes-"));
  store = new SQLiteMailboxStore(path.join(tempDir, "inbox.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("SQLiteMailboxStore", () => {
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
