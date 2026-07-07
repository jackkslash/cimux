import fs from "node:fs";
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
  format: "toml" | "json" | "markdown";
  snippet: string;
};

export type InstallPlan = {
  targets: InstallPlanTarget[];
};

export type InstallResult = {
  path: string;
  status: "created" | "updated" | "unchanged";
  backupPath: string | null;
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
        // Codex hooks share Claude Code's shape; Codex asks the user to trust
        // a hook on first use and after any change to it.
        path: path.join(codexHome, "hooks.json"),
        purpose:
          "Notify on unread mail each prompt; brief the agent on its mailbox at session start.",
        format: "json",
        snippet: createHookSnippet(parsed.packageCommand, "codex")
      },
      {
        harness: "codex",
        path: path.join(codexHome, "AGENTS.md"),
        purpose: "Teach Codex agents to check and send Cimux mail without prompting.",
        format: "markdown",
        snippet: createAgentNormsSnippet()
      },
      {
        harness: "claude",
        path: path.join(claudeHome, "settings.json"),
        purpose:
          "Notify on unread mail each prompt; brief the agent on its mailbox at session start.",
        format: "json",
        snippet: createHookSnippet(parsed.packageCommand, "claude")
      },
      {
        harness: "claude",
        path: path.join(claudeHome, "CLAUDE.md"),
        purpose: "Teach Claude Code agents to check and send Cimux mail without prompting.",
        format: "markdown",
        snippet: createAgentNormsSnippet()
      },
      {
        harness: "claude",
        // Claude Code reads user-scope MCP servers from ~/.claude.json.
        path: path.join(parsed.homeDirectory, ".claude.json"),
        purpose: "Register the Cimux MCP server for Claude Code (user scope).",
        format: "json",
        snippet: createClaudeMcpSnippet(parsed.packageCommand)
      }
    ]
  };
}

export function applyInstallPlan(plan: InstallPlan): InstallResult[] {
  return plan.targets.map((target) => applyInstallTarget(target));
}

function applyInstallTarget(target: InstallPlanTarget): InstallResult {
  fs.mkdirSync(path.dirname(target.path), { recursive: true });

  if (target.format === "toml") {
    return applyTomlTarget(target);
  }

  if (target.format === "markdown") {
    return applyMarkdownTarget(target);
  }

  return applyJsonTarget(target);
}

function applyTomlTarget(target: InstallPlanTarget): InstallResult {
  const existing = readTextIfExists(target.path);
  if (existing?.includes("[mcp_servers.cimux]")) {
    return {
      path: target.path,
      status: "unchanged",
      backupPath: null
    };
  }

  const backupPath = existing === null ? null : writeBackup(target.path, existing);
  const next = existing === null ? target.snippet : appendBlock(existing, target.snippet);
  fs.writeFileSync(target.path, next, "utf8");

  return {
    path: target.path,
    status: existing === null ? "created" : "updated",
    backupPath
  };
}

function applyMarkdownTarget(target: InstallPlanTarget): InstallResult {
  const existing = readTextIfExists(target.path);
  if (existing?.includes(AGENT_NORMS_MARKER)) {
    return {
      path: target.path,
      status: "unchanged",
      backupPath: null
    };
  }

  const backupPath = existing === null ? null : writeBackup(target.path, existing);
  const next = existing === null ? target.snippet : appendBlock(existing, target.snippet);
  fs.writeFileSync(target.path, next, "utf8");

  return {
    path: target.path,
    status: existing === null ? "created" : "updated",
    backupPath
  };
}

function applyJsonTarget(target: InstallPlanTarget): InstallResult {
  const existingText = readTextIfExists(target.path);
  const existingValue = existingText === null ? {} : parseJsonObject(existingText, target.path);
  const snippetValue = parseJsonObject(target.snippet, target.path);
  const mergedValue = mergeJson(existingValue, snippetValue);
  const nextText = `${JSON.stringify(mergedValue, null, 2)}\n`;

  if (existingText === nextText) {
    return {
      path: target.path,
      status: "unchanged",
      backupPath: null
    };
  }

  const backupPath = existingText === null ? null : writeBackup(target.path, existingText);
  fs.writeFileSync(target.path, nextText, "utf8");

  return {
    path: target.path,
    status: existingText === null ? "created" : "updated",
    backupPath
  };
}

function mergeJson(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = merged[key];
    if (isPlainObject(existingValue) && isPlainObject(incomingValue)) {
      merged[key] = mergeJson(existingValue, incomingValue);
    } else if (Array.isArray(existingValue) && Array.isArray(incomingValue)) {
      merged[key] = mergeArray(existingValue, incomingValue);
    } else {
      merged[key] = incomingValue;
    }
  }

  return merged;
}

function mergeArray(existing: unknown[], incoming: unknown[]): unknown[] {
  const merged = [...existing];
  const seen = new Set(existing.map(stableStringify));

  for (const item of incoming) {
    const key = stableStringify(item);
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged;
}

function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function parseJsonObject(value: string, filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!isPlainObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }

  return parsed;
}

function writeBackup(filePath: string, content: string): string {
  const backupPath = `${filePath}.cimux.bak`;
  fs.writeFileSync(backupPath, content, "utf8");
  return backupPath;
}

function appendBlock(existing: string, block: string): string {
  const trimmed = existing.trimEnd();
  return `${trimmed}\n\n${block}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (!isPlainObject(value)) {
    return JSON.stringify(value);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }

  return JSON.stringify(sorted);
}

function createCodexMcpSnippet(packageCommand: string): string {
  return `[mcp_servers.cimux]
command = "${packageCommand}"
args = ["mcp"]
startup_timeout_sec = 10
tool_timeout_sec = 60
`;
}

// Codex and Claude Code share the same hooks JSON shape and event names.
function createHookSnippet(packageCommand: string, harness: "codex" | "claude"): string {
  return JSON.stringify(
    {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: `${packageCommand} notify --harness ${harness}`
              }
            ]
          }
        ],
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `${packageCommand} brief --harness ${harness}`
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

const AGENT_NORMS_MARKER = "<!-- cimux:norms -->";

function createAgentNormsSnippet(): string {
  return `${AGENT_NORMS_MARKER}
## Cimux agent mail

You have a Cimux mailbox (MCP server \`cimux\`). Follow these norms without being asked:

- When notified of unread context packages, call \`check_inbox\`, use \`read_context\` on what is relevant, and \`ack_context\` after loading it.
- When you finish work whose outcome another agent or a future session may need (root causes, decisions, gotchas, handoffs), send it with \`send_context\`: short title, tight summary, full detail in the body, artifact pointers instead of pasted file contents.
- Find recipients with \`list_mailboxes\`; only existing mailboxes can receive mail. Register your own with \`register_session\` if unsure.
<!-- cimux:end -->
`;
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
