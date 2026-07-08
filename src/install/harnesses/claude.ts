import type { HarnessDescriptor } from "./shared.js";

export const claudeHarness: HarnessDescriptor = {
  name: "claude",
  detectDir: ".claude",
  mcp: {
    // Claude Code reads user-scope MCP servers from ~/.claude.json.
    path: ".claude.json",
    format: "json",
    purpose: "Register the Cimux MCP server for Claude Code (user scope).",
    snippet: createClaudeMcpSnippet
  },
  hooks: { path: ".claude/settings.json" },
  norms: {
    path: ".claude/CLAUDE.md",
    purpose: "Teach Claude Code agents to check and send Cimux mail without prompting."
  }
};

function createClaudeMcpSnippet(packageCommand: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        cimux: {
          command: packageCommand,
          args: ["mcp"]
        }
      }
    },
    null,
    2
  );
}
