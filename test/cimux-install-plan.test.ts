import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyInstallPlan, createInstallPlan } from "../src/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-install-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("Cimux install plan", () => {
  it("lists the first config files Cimux supports", () => {
    const plan = createInstallPlan({
      homeDirectory: "/Users/example",
      packageCommand: "cimux"
    });

    expect(plan.targets.map((target) => target.path)).toEqual([
      "/Users/example/.codex/config.toml",
      "/Users/example/.codex/hooks.json",
      "/Users/example/.claude/settings.json",
      "/Users/example/.claude/.mcp.json"
    ]);
  });

  it("uses inferred mailbox hook commands so users do not name sessions by hand", () => {
    const plan = createInstallPlan({
      homeDirectory: "/Users/example",
      packageCommand: "cimux"
    });
    const snippets = plan.targets.map((target) => target.snippet).join("\n");

    expect(snippets).toContain("cimux notify --harness codex");
    expect(snippets).toContain("cimux notify --harness claude");
    expect(snippets).not.toContain("--mailbox");
  });

  it("registers Cimux as a stdio MCP server", () => {
    const plan = createInstallPlan({
      homeDirectory: "/Users/example",
      packageCommand: "cimux"
    });

    expect(plan.targets[0]?.snippet).toContain("[mcp_servers.cimux]");
    expect(plan.targets[0]?.snippet).toContain('command = "cimux"');
    expect(plan.targets[0]?.snippet).toContain('args = ["mcp"]');
    expect(plan.targets[3]?.snippet).toContain('"mcpServers"');
    expect(plan.targets[3]?.snippet).toContain('"args": [\n        "mcp"\n      ]');
  });

  it("creates missing config files when applying the install plan", () => {
    const plan = createInstallPlan({
      homeDirectory: tempDir,
      packageCommand: "cimux"
    });

    const results = applyInstallPlan(plan);

    expect(results.map((result) => result.status)).toEqual([
      "created",
      "created",
      "created",
      "created"
    ]);
    expect(fs.readFileSync(path.join(tempDir, ".codex", "config.toml"), "utf8")).toContain(
      "[mcp_servers.cimux]"
    );
    expect(fs.readFileSync(path.join(tempDir, ".codex", "hooks.json"), "utf8")).toContain(
      "cimux notify --harness codex"
    );
    expect(fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf8")).toContain(
      "cimux notify --harness claude"
    );
    expect(fs.readFileSync(path.join(tempDir, ".claude", ".mcp.json"), "utf8")).toContain(
      '"cimux"'
    );
  });

  it("merges with existing JSON and writes backups before updating", () => {
    const hooksPath = path.join(tempDir, ".codex", "hooks.json");
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(
      hooksPath,
      JSON.stringify(
        {
          hooks: {
            UserPromptSubmit: [
              {
                hooks: [{ type: "command", command: "existing-hook" }]
              }
            ]
          }
        },
        null,
        2
      ) + "\n"
    );

    const results = applyInstallPlan(
      createInstallPlan({
        homeDirectory: tempDir,
        packageCommand: "cimux"
      })
    );
    const hooks = JSON.parse(fs.readFileSync(hooksPath, "utf8")) as {
      hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = hooks.hooks.UserPromptSubmit.flatMap((entry) =>
      entry.hooks.map((hook) => hook.command)
    );

    expect(commands).toContain("existing-hook");
    expect(commands).toContain("cimux notify --harness codex");
    expect(results.find((result) => result.path === hooksPath)?.backupPath).toBe(
      `${hooksPath}.cimux.bak`
    );
    expect(fs.readFileSync(`${hooksPath}.cimux.bak`, "utf8")).toContain("existing-hook");
  });

  it("does not duplicate install snippets when applying twice", () => {
    const plan = createInstallPlan({
      homeDirectory: tempDir,
      packageCommand: "cimux"
    });

    applyInstallPlan(plan);
    const secondRun = applyInstallPlan(plan);
    const codexConfig = fs.readFileSync(path.join(tempDir, ".codex", "config.toml"), "utf8");
    const codexHooks = fs.readFileSync(path.join(tempDir, ".codex", "hooks.json"), "utf8");

    expect(secondRun.map((result) => result.status)).toEqual([
      "unchanged",
      "unchanged",
      "unchanged",
      "unchanged"
    ]);
    expect(codexConfig.match(/\[mcp_servers\.cimux\]/g)).toHaveLength(1);
    expect(codexHooks.match(/cimux notify --harness codex/g)).toHaveLength(1);
  });
});
