import os from "node:os";
import path from "node:path";
import { z } from "zod";

export const installPlanInputSchema = z.object({
  packageCommand: z.string().min(1).default("cimux"),
  homeDirectory: z.string().min(1).default(os.homedir())
});

export type InstallPlanInput = z.input<typeof installPlanInputSchema>;

export type InstallPlanTarget = {
  harness: "codex" | "claude";
  path: string;
  purpose: string;
  format: "toml" | "json";
  snippet: string;
};

export type InstallPlan = {
  targets: InstallPlanTarget[];
};

export function createInstallPlan(input: InstallPlanInput = {}): InstallPlan {
  const parsed = installPlanInputSchema.parse(input);
  const codexHome = path.join(parsed.homeDirectory, ".codex");
  const claudeHome = path.join(parsed.homeDirectory, ".claude");

  return {
    targets: [
      {
        harness: "codex",
        path: path.join(codexHome, "config.toml"),
        purpose: "Register the Cimux MCP server for Codex.",
        format: "toml",
        snippet: createCodexMcpSnippet(parsed.packageCommand)
      },
      {
        harness: "codex",
        path: path.join(codexHome, "hooks.json"),
        purpose:
          "Run a zero-token inbox check on each user prompt. Empty inboxes emit no output.",
        format: "json",
        snippet: createCodexHookSnippet(parsed.packageCommand)
      },
      {
        harness: "claude",
        path: path.join(claudeHome, "settings.json"),
        purpose:
          "Run a zero-token inbox check on each user prompt. Empty inboxes emit no output.",
        format: "json",
        snippet: createClaudeHookSnippet(parsed.packageCommand)
      },
      {
        harness: "claude",
        path: path.join(claudeHome, ".mcp.json"),
        purpose: "Register the Cimux MCP server for Claude Code.",
        format: "json",
        snippet: createClaudeMcpSnippet(parsed.packageCommand)
      }
    ]
  };
}

function createCodexMcpSnippet(packageCommand: string): string {
  return `[mcp_servers.cimux]
command = "${packageCommand}"
args = ["mcp"]
startup_timeout_sec = 10
tool_timeout_sec = 60
`;
}

function createCodexHookSnippet(packageCommand: string): string {
  return JSON.stringify(
    {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `${packageCommand} notify --harness codex`
              }
            ]
          }
        ]
      }
    },
    null,
    2
  );
}

function createClaudeHookSnippet(packageCommand: string): string {
  return JSON.stringify(
    {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `${packageCommand} notify --harness claude`
              }
            ]
          }
        ]
      }
    },
    null,
    2
  );
}

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

