import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyInstallPlan,
  createInstallPlan,
  detectInstalledHarnesses
} from "../src/index.js";

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
      "/Users/example/.codex/AGENTS.md",
      "/Users/example/.claude.json",
      "/Users/example/.claude/settings.json",
      "/Users/example/.claude/CLAUDE.md"
    ]);
  });

  it("plans only the requested harnesses", () => {
    const plan = createInstallPlan({
      homeDirectory: "/Users/example",
      packageCommand: "cimux",
      harnesses: ["claude"]
    });

    expect(plan.targets.map((target) => target.path)).toEqual([
      "/Users/example/.claude.json",
      "/Users/example/.claude/settings.json",
      "/Users/example/.claude/CLAUDE.md"
    ]);
  });

  it("detects installed harnesses by their home directories", () => {
    expect(detectInstalledHarnesses(tempDir)).toEqual([]);

    fs.mkdirSync(path.join(tempDir, ".codex"));
    expect(detectInstalledHarnesses(tempDir)).toEqual(["codex"]);

    fs.mkdirSync(path.join(tempDir, ".claude"));
    expect(detectInstalledHarnesses(tempDir)).toEqual(["codex", "claude"]);
  });

  it("uses inferred mailbox hook commands so users do not name sessions by hand", () => {
    const plan = createInstallPlan({
      homeDirectory: "/Users/example",
      packageCommand: "cimux"
    });
    const snippets = plan.targets.map((target) => target.snippet).join("\n");

    expect(snippets).toContain("cimux notify --harness codex");
    expect(snippets).toContain("cimux brief --harness codex");
    expect(snippets).toContain("cimux notify --harness claude");
    expect(snippets).toContain("cimux brief --harness claude");
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
    expect(fs.readFileSync(path.join(tempDir, ".codex", "AGENTS.md"), "utf8")).toContain(
      "Cimux agent mail"
    );
    expect(fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf8")).toContain(
      "cimux notify --harness claude"
    );
    expect(fs.readFileSync(path.join(tempDir, ".claude", "CLAUDE.md"), "utf8")).toContain(
      "Cimux agent mail"
    );
    expect(fs.readFileSync(path.join(tempDir, ".claude.json"), "utf8")).toContain(
      '"cimux"'
    );
  });

  it("appends agent norms to an existing CLAUDE.md without duplicating them", () => {
    const claudeMdPath = path.join(tempDir, ".claude", "CLAUDE.md");
    fs.mkdirSync(path.dirname(claudeMdPath), { recursive: true });
    fs.writeFileSync(claudeMdPath, "# My existing notes\n\nKeep these.\n");

    const plan = createInstallPlan({ homeDirectory: tempDir, packageCommand: "cimux" });
    applyInstallPlan(plan);
    const secondRun = applyInstallPlan(plan);
    const content = fs.readFileSync(claudeMdPath, "utf8");

    expect(content).toContain("Keep these.");
    expect(content.match(/Cimux agent mail/g)).toHaveLength(1);
    expect(
      secondRun.find((result) => result.path === claudeMdPath)?.status
    ).toBe("unchanged");
  });

  it("merges with existing JSON and writes backups before updating", () => {
    const settingsPath = path.join(tempDir, ".claude", "settings.json");
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(
      settingsPath,
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
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
      hooks: { UserPromptSubmit: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = settings.hooks.UserPromptSubmit.flatMap((entry) =>
      entry.hooks.map((hook) => hook.command)
    );

    expect(commands).toContain("existing-hook");
    expect(commands).toContain("cimux notify --harness claude");
    expect(results.find((result) => result.path === settingsPath)?.backupPath).toBe(
      `${settingsPath}.cimux.bak`
    );
    expect(fs.readFileSync(`${settingsPath}.cimux.bak`, "utf8")).toContain("existing-hook");
  });

  it("does not duplicate install snippets when applying twice", () => {
    const plan = createInstallPlan({
      homeDirectory: tempDir,
      packageCommand: "cimux"
    });

    applyInstallPlan(plan);
    const secondRun = applyInstallPlan(plan);
    const codexConfig = fs.readFileSync(path.join(tempDir, ".codex", "config.toml"), "utf8");
    const claudeSettings = fs.readFileSync(
      path.join(tempDir, ".claude", "settings.json"),
      "utf8"
    );

    expect(secondRun.map((result) => result.status)).toEqual([
      "unchanged",
      "unchanged",
      "unchanged",
      "unchanged",
      "unchanged",
      "unchanged"
    ]);
    expect(codexConfig.match(/\[mcp_servers\.cimux\]/g)).toHaveLength(1);
    expect(claudeSettings.match(/cimux notify --harness claude/g)).toHaveLength(1);
  });
});
