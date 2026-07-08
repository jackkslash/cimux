import type { HarnessDescriptor } from "./shared.js";

// Cursor has no user-level norms file (User Rules live in its settings GUI),
// so agents learn the mail norms from the session brief instead.
export const cursorHarness: HarnessDescriptor = {
  name: "cursor",
  detectDir: ".cursor",
  mcp: {
    path: ".cursor/mcp.json",
    format: "json",
    purpose: "Register the Cimux MCP server for Cursor.",
    snippet: createCursorMcpSnippet
  },
  hooks: {
    path: ".cursor/hooks.json",
    purpose: "Brief the agent on its mailbox and unread mail at session start.",
    snippet: createCursorHookSnippet
  }
};

function createCursorMcpSnippet(packageCommand: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        cimux: {
          type: "stdio",
          command: packageCommand,
          args: ["mcp"]
        }
      }
    },
    null,
    2
  );
}

// Cursor's hook config differs from Claude/Codex: a version field, camelCase
// events, and hooks respond with JSON on stdout — sessionStart injects
// context via {"additional_context": ...}, which `brief --format cursor`
// emits. There is no context-injecting per-prompt event, so Cursor gets the
// session brief only.
function createCursorHookSnippet(packageCommand: string): string {
  return JSON.stringify(
    {
      version: 1,
      hooks: {
        sessionStart: [
          {
            command: `${packageCommand} brief --harness cursor --format cursor`
          }
        ]
      }
    },
    null,
    2
  );
}
