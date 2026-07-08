import type { HarnessDescriptor } from "./shared.js";

export const codexHarness: HarnessDescriptor = {
  name: "codex",
  detectDir: ".codex",
  mcp: {
    path: ".codex/config.toml",
    format: "toml",
    purpose: "Register the Cimux MCP server for Codex.",
    snippet: createCodexMcpSnippet
  },
  // Codex hooks share Claude Code's shape; Codex asks the user to trust
  // a hook on first use and after any change to it.
  hooks: { path: ".codex/hooks.json" },
  norms: {
    path: ".codex/AGENTS.md",
    purpose: "Teach Codex agents to check and send Cimux mail without prompting."
  }
};

function createCodexMcpSnippet(packageCommand: string): string {
  return `[mcp_servers.cimux]
command = "${packageCommand}"
args = ["mcp"]
startup_timeout_sec = 10
tool_timeout_sec = 60
`;
}
