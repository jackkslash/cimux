import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRuntimeMailbox } from "../src/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-runtime-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("runtime mailbox resolution", () => {
  it("uses an explicit mailbox when one is provided", () => {
    const result = resolveRuntimeMailbox({
      explicitMailbox: "codex/manual-name",
      harness: "claude",
      cwd: tempDir
    });

    expect(result.mailbox).toBe("codex/manual-name");
    expect(result.inferredFrom).toBe("explicit");
  });

  it("prefers the current git branch over the folder name", () => {
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "ignore" });
    execFileSync("git", ["checkout", "-b", "Feature/Auth-Handoff"], {
      cwd: tempDir,
      stdio: "ignore"
    });

    const result = resolveRuntimeMailbox({
      harness: "Codex",
      cwd: tempDir
    });

    expect(result.mailbox).toBe("codex/feature-auth-handoff");
    expect(result.inferredFrom).toBe("branch");
    expect(result.branchName).toBe("Feature/Auth-Handoff");
  });

  it("falls back to the folder name outside a git repo", () => {
    const cwd = path.join(tempDir, "Checkout UI");
    fs.mkdirSync(cwd);

    const result = resolveRuntimeMailbox({
      harness: "Claude",
      cwd
    });

    expect(result.mailbox).toBe("claude/checkout-ui");
    expect(result.inferredFrom).toBe("folder");
  });
});
