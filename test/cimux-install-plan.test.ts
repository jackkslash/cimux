import { describe, expect, it } from "vitest";
import { createInstallPlan } from "../src/index.js";

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
});

