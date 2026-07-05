import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ackContext,
  checkInbox,
  ContextPackageNotFoundError,
  MailboxAccessError,
  readContext,
  registerSession,
  sendContext,
  SQLiteCimuxStore,
  UnknownMailboxError
} from "../src/index.js";

let tempDir: string;
let store: SQLiteCimuxStore;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-service-"));
  store = new SQLiteCimuxStore(path.join(tempDir, "cimux.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Cimux mailbox service", () => {
  it("registers an inferred session mailbox", async () => {
    const result = await registerSession(store, {
      harness: "Codex",
      branchName: "Feature/Auth Handoff"
    });

    expect(result.mailbox.name).toBe("codex/feature-auth-handoff");
    expect(result.inferred).toBe(true);
    expect(result.mailboxes.map((mailbox) => mailbox.name)).toEqual([
      "codex/feature-auth-handoff"
    ]);
  });

  it("sends context and returns token-aware previews", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");

    const sent = await sendContext(store, {
      fromMailbox: "codex/backend-auth",
      toMailbox: "claude/frontend-login",
      title: "Auth handoff",
      summary: "Frontend needs to handle ExpiredSessionError.",
      body: "Full context that should only appear when read_context is called.",
      tags: ["auth", "frontend"],
      artifacts: {
        files: [{ path: "src/auth/session.ts" }],
        codeSnippets: [{ language: "ts", code: "throw new ExpiredSessionError();" }]
      },
      payload: {
        privateDetail: "only-read-context-should-return-this"
      }
    });

    const inbox = await checkInbox(store, {
      mailbox: "claude/frontend-login"
    });
    const serializedPreview = JSON.stringify(inbox.previews);

    expect(sent.contextPackage.id).toMatch(/^ctx_/);
    expect(inbox.previews).toHaveLength(1);
    expect(inbox.previews[0]?.title).toBe("Auth handoff");
    expect(inbox.previews[0]?.artifactCounts.codeSnippets).toBe(1);
    expect(inbox.previews[0]?.payloadKeys).toEqual(["privateDetail"]);
    expect(serializedPreview).not.toContain("Full context");
    expect(serializedPreview).not.toContain("throw new ExpiredSessionError");
    expect(serializedPreview).not.toContain("only-read-context-should-return-this");
  });

  it("rejects sends to unknown mailboxes", async () => {
    await store.createMailbox("codex/backend-auth");

    await expect(
      sendContext(store, {
        fromMailbox: "codex/backend-auth",
        toMailbox: "claude/frontend-login",
        title: "Auth handoff",
        summary: "Frontend needs context.",
        body: "Details.",
        tags: [],
        artifacts: {},
        payload: {}
      })
    ).rejects.toBeInstanceOf(UnknownMailboxError);
  });

  it("reads and acknowledges only packages addressed to the given mailbox", async () => {
    await store.createMailbox("codex/backend-auth");
    await store.createMailbox("claude/frontend-login");
    await store.createMailbox("claude/other-task");
    const sent = await sendContext(store, {
      fromMailbox: "codex/backend-auth",
      toMailbox: "claude/frontend-login",
      title: "Auth handoff",
      summary: "Frontend needs context.",
      body: "The full handoff body.",
      tags: [],
      artifacts: {},
      payload: {}
    });

    await expect(
      readContext(store, {
        mailbox: "claude/other-task",
        id: sent.contextPackage.id
      })
    ).rejects.toBeInstanceOf(MailboxAccessError);

    const read = await readContext(store, {
      mailbox: "claude/frontend-login",
      id: sent.contextPackage.id
    });
    const acked = await ackContext(store, {
      mailbox: "claude/frontend-login",
      id: sent.contextPackage.id,
      note: "Loaded into context."
    });

    expect(read.contextPackage.body).toBe("The full handoff body.");
    expect(read.contextPackage.readAt).toEqual(expect.any(String));
    expect(acked.contextPackage.ack.status).toBe("acknowledged");
    expect(acked.contextPackage.ack.ackBy).toBe("claude/frontend-login");
  });

  it("reports missing Context Packages before marking anything read", async () => {
    await store.createMailbox("claude/frontend-login");

    await expect(
      readContext(store, {
        mailbox: "claude/frontend-login",
        id: "ctx_missing"
      })
    ).rejects.toBeInstanceOf(ContextPackageNotFoundError);
  });
});
