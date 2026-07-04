import { describe, expect, it } from "vitest";
import { inferMailboxName, registerMailbox } from "../src/index.js";
import type { Mailbox, MailboxStore } from "../src/index.js";

describe("inferMailboxName", () => {
  it("uses an explicit mailbox when provided", () => {
    expect(
      inferMailboxName({
        harness: "codex",
        explicitMailbox: "claude/frontend-login",
        branchName: "backend-auth"
      })
    ).toBe("claude/frontend-login");
  });

  it("prefers branch name over task and folder names", () => {
    expect(
      inferMailboxName({
        harness: "Codex",
        branchName: "Feature/Auth Login",
        taskName: "Fix Login Redirect",
        folderName: "web-app"
      })
    ).toBe("codex/feature-auth-login");
  });

  it("uses task name when no branch name exists", () => {
    expect(
      inferMailboxName({
        harness: "claude",
        taskName: "Fix Login Redirect",
        folderName: "web-app"
      })
    ).toBe("claude/fix-login-redirect");
  });

  it("uses folder name as the stable fallback", () => {
    expect(
      inferMailboxName({
        harness: "cursor",
        folderName: "checkout-ui"
      })
    ).toBe("cursor/checkout-ui");
  });

  it("uses default when no local name context exists", () => {
    expect(inferMailboxName({ harness: "codex" })).toBe("codex/default");
  });

  it("rejects invalid explicit mailbox names", () => {
    expect(() =>
      inferMailboxName({
        harness: "codex",
        explicitMailbox: "frontend"
      })
    ).toThrow();
  });
});

describe("registerMailbox", () => {
  it("creates the inferred mailbox and returns known mailboxes", async () => {
    const store = new MemoryMailboxStore();
    await store.createMailbox("claude/frontend-login");

    const result = await registerMailbox(store, {
      harness: "codex",
      branchName: "backend-auth"
    });

    expect(result.mailbox.name).toBe("codex/backend-auth");
    expect(result.inferred).toBe(true);
    expect(result.mailboxes.map((mailbox) => mailbox.name)).toEqual([
      "claude/frontend-login",
      "codex/backend-auth"
    ]);
  });

  it("marks explicit mailbox registration as not inferred", async () => {
    const store = new MemoryMailboxStore();

    const result = await registerMailbox(store, {
      harness: "codex",
      explicitMailbox: "codex/manual-name"
    });

    expect(result.mailbox.name).toBe("codex/manual-name");
    expect(result.inferred).toBe(false);
  });
});

class MemoryMailboxStore implements MailboxStore {
  private readonly mailboxes = new Map<string, Mailbox>();

  async createMailbox(name: string): Promise<Mailbox> {
    const existing = this.mailboxes.get(name);
    if (existing) {
      return existing;
    }

    const mailbox = {
      name,
      createdAt: "2026-07-04T00:00:00.000Z",
      lastSeenAt: null
    };
    this.mailboxes.set(name, mailbox);
    return mailbox;
  }

  async getMailbox(name: string): Promise<Mailbox | null> {
    return this.mailboxes.get(name) ?? null;
  }

  async listMailboxes(): Promise<Mailbox[]> {
    return Array.from(this.mailboxes.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
  }

  close(): void {}
}
