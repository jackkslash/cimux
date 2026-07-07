import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCimuxCli, version as packageVersion } from "../src/index.js";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-cli-"));
  dbPath = path.join(tempDir, "cimux.sqlite");
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Cimux CLI", () => {
  it("prints help and version without opening the database", async () => {
    const help = await runCli(["--help"]);
    const version = await runCli(["--version"]);

    expect(help.code).toBe(0);
    expect(help.stdout).toContain("Local-first mailboxes");
    expect(help.stdout).toContain("cimux send");
    expect(version.code).toBe(0);
    expect(version.stdout).toBe(`cimux ${packageVersion}`);
  });

  it("runs a local mailbox handoff end to end", async () => {
    await runCli(["register", "--mailbox", "codex/backend-auth"]);
    await runCli(["register", "--mailbox", "claude/frontend-login"]);

    const sent = await runCli([
      "send",
      "--from",
      "codex/backend-auth",
      "--to",
      "claude/frontend-login",
      "--title",
      "Auth handoff",
      "--summary",
      "Frontend should handle the new auth error.",
      "--body",
      "validateSession now throws ExpiredSessionError.",
      "--tags",
      "auth,frontend"
    ]);
    const sentJson = JSON.parse(sent.stdout) as {
      contextPackage: { id: string };
    };

    const notification = await runCli([
      "notify",
      "--mailbox",
      "claude/frontend-login"
    ]);
    const checked = await runCli(["check", "--mailbox", "claude/frontend-login"]);
    const read = await runCli([
      "read",
      "--mailbox",
      "claude/frontend-login",
      "--id",
      sentJson.contextPackage.id
    ]);
    const acked = await runCli([
      "ack",
      "--mailbox",
      "claude/frontend-login",
      "--id",
      sentJson.contextPackage.id,
      "--note",
      "Loaded locally."
    ]);

    const checkJson = JSON.parse(checked.stdout) as {
      previews: Array<{ id: string; title: string }>;
    };
    const readJson = JSON.parse(read.stdout) as {
      contextPackage: { body: string; readAt: string | null };
    };
    const ackJson = JSON.parse(acked.stdout) as {
      contextPackage: { ack: { status: string; ackBy: string; note: string } };
    };

    expect(notification.stdout).toContain("1 unread context package");
    expect(checkJson.previews).toEqual([
      expect.objectContaining({
        id: sentJson.contextPackage.id,
        title: "Auth handoff"
      })
    ]);
    expect(readJson.contextPackage.body).toBe(
      "validateSession now throws ExpiredSessionError."
    );
    expect(readJson.contextPackage.readAt).toEqual(expect.any(String));
    expect(ackJson.contextPackage.ack).toEqual(
      expect.objectContaining({
        status: "acknowledged",
        ackBy: "claude/frontend-login",
        note: "Loaded locally."
      })
    );
  });

  it("returns a non-zero exit code with a useful message for bad input", async () => {
    const result = await runCli(["check"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Expected --mailbox");
  });

  it("rejects unknown flags instead of silently ignoring them", async () => {
    const result = await runCli(["check", "--mailbox", "claude/x", "--unknown-flag"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--unknown-flag");
    expect(result.stderr).toContain("Usage: cimux check");
  });

  it("does not eat a following flag as a missing value", async () => {
    const result = await runCli([
      "send",
      "--from",
      "codex/a",
      "--title",
      "--summary",
      "oops"
    ]);

    // --title has no value; parseArgs must not consume --summary as one.
    expect(result.code).toBe(1);
    expect(result.stderr).not.toContain('"--summary"');
  });

  it("formats validation errors as one line per issue", async () => {
    const result = await runCli([
      "send",
      "--from",
      "not-a-mailbox-name",
      "--to",
      "claude/frontend-login",
      "--title",
      "t",
      "--summary",
      "s",
      "--body",
      "b"
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid input:");
    expect(result.stderr).toContain("--fromMailbox");
    expect(result.stderr).not.toContain('"code"');
  });

  it("sends artifacts and payload from JSON flags", async () => {
    await runCli(["register", "--mailbox", "codex/backend-auth"]);
    await runCli(["register", "--mailbox", "claude/frontend-login"]);

    const sent = await runCli([
      "send",
      "--from",
      "codex/backend-auth",
      "--to",
      "claude/frontend-login",
      "--title",
      "With artifacts",
      "--summary",
      "s",
      "--body",
      "b",
      "--artifacts-json",
      '{"files":[{"path":"src/auth.ts","note":"start here"}]}',
      "--payload-json",
      '{"ticket":"AUTH-42"}'
    ]);
    const sentJson = JSON.parse(sent.stdout) as {
      contextPackage: {
        artifacts: { files: Array<{ path: string }> };
        payload: Record<string, unknown>;
      };
    };

    expect(sent.code).toBe(0);
    expect(sentJson.contextPackage.artifacts.files[0]?.path).toBe("src/auth.ts");
    expect(sentJson.contextPackage.payload).toEqual({ ticket: "AUTH-42" });
  });

  it("rejects malformed JSON flags with a clear message", async () => {
    const result = await runCli([
      "send",
      "--from",
      "codex/backend-auth",
      "--to",
      "claude/frontend-login",
      "--title",
      "t",
      "--summary",
      "s",
      "--body",
      "b",
      "--artifacts-json",
      "{not json"
    ]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid JSON for --artifacts-json");
  });

  it("applies --limit to check", async () => {
    await runCli(["register", "--mailbox", "codex/backend-auth"]);
    await runCli(["register", "--mailbox", "claude/frontend-login"]);
    for (const title of ["one", "two", "three"]) {
      await runCli([
        "send",
        "--from",
        "codex/backend-auth",
        "--to",
        "claude/frontend-login",
        "--title",
        title,
        "--summary",
        "s",
        "--body",
        "b"
      ]);
    }

    const checked = await runCli([
      "check",
      "--mailbox",
      "claude/frontend-login",
      "--limit",
      "2"
    ]);
    const checkJson = JSON.parse(checked.stdout) as { previews: unknown[] };

    expect(checked.code).toBe(0);
    expect(checkJson.previews).toHaveLength(2);
  });
});

async function runCli(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCimuxCli(
    argv,
    { CIMUX_DB_PATH: dbPath },
    tempDir,
    {
      log(message) {
        stdout.push(message);
      },
      error(message) {
        stderr.push(message);
      }
    }
  );

  return {
    code,
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n")
  };
}
