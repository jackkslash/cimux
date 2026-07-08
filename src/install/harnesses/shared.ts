export const SUPPORTED_HARNESSES = ["codex", "claude"] as const;

export type HarnessName = (typeof SUPPORTED_HARNESSES)[number];

// Adding a harness: add its name above, create <name>.ts exporting a
// descriptor, and register it in index.ts. Paths are relative to the user's
// home directory; hooks and norms are optional tiers, and snippet overrides
// let a harness diverge from the shared defaults below.
export type HarnessDescriptor = {
  name: HarnessName;
  // Directory whose presence means the harness is installed on this machine.
  detectDir: string;
  mcp: {
    path: string;
    format: "toml" | "json";
    purpose: string;
    snippet: (packageCommand: string) => string;
  };
  hooks?: {
    path: string;
    snippet?: (packageCommand: string, harness: HarnessName) => string;
  };
  norms?: {
    path: string;
    purpose: string;
    snippet?: () => string;
  };
};

export const HOOKS_PURPOSE =
  "Notify on unread mail each prompt; brief the agent on its mailbox at session start.";

export const AGENT_NORMS_MARKER = "<!-- cimux:norms -->";

// Codex and Claude Code share the same hooks JSON shape and event names.
export function createHookSnippet(packageCommand: string, harness: HarnessName): string {
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

export function createAgentNormsSnippet(): string {
  return `${AGENT_NORMS_MARKER}
## Cimux agent mail

You have a Cimux mailbox (MCP server \`cimux\`). Follow these norms without being asked:

- When notified of unread context packages, call \`check_inbox\`, use \`read_context\` on what is relevant, and \`ack_context\` after loading it.
- When you finish work whose outcome another agent or a future session may need (root causes, decisions, gotchas, handoffs), send it with \`send_context\`: short title, tight summary, full detail in the body, artifact pointers instead of pasted file contents.
- Find recipients with \`list_mailboxes\`; only existing mailboxes can receive mail. Register your own with \`register_session\` if unsure.
<!-- cimux:end -->
`;
}
