import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createContextPackageInputSchema } from "../model/context-package.js";
import { registerMailboxInputSchema } from "../registration/mailbox-registration.js";
import {
  ackContext,
  ackContextInputSchema,
  checkInbox,
  checkInboxInputSchema,
  listMailboxes,
  readContext,
  readContextInputSchema,
  registerSession,
  sendContext
} from "../service/cimux-mailbox-service.js";
import { SQLiteCimuxStore } from "../storage/sqlite-cimux-store.js";
import { version } from "../version.js";

export function createCimuxMcpServer(databasePath = defaultDatabasePath()): McpServer {
  const store = new SQLiteCimuxStore(databasePath);
  const server = new McpServer({
    name: "cimux",
    version
  });

  server.registerTool(
    "register_session",
    {
      title: "Register Session",
      description:
        "Register or infer the current agent mailbox. Branch names are preferred over task/folder names.",
      inputSchema: registerMailboxInputSchema.shape
    },
    async (input) => toToolResult(await registerSession(store, input))
  );

  server.registerTool(
    "list_mailboxes",
    {
      title: "List Mailboxes",
      description:
        "List registered mailbox names. Use this to find the recipient before send_context.",
      inputSchema: {}
    },
    async () => {
      // Names only: this response is read by agents, so keep it token-lean.
      const result = await listMailboxes(store);
      return toToolResult({
        mailboxes: result.mailboxes.map((mailbox) => mailbox.name)
      });
    }
  );

  server.registerTool(
    "send_context",
    {
      title: "Send Context",
      description:
        "Send a structured Context Package to an existing mailbox. Unknown mailboxes are rejected.",
      inputSchema: createContextPackageInputSchema.shape
    },
    async (input) => toToolResult(await sendContext(store, input))
  );

  server.registerTool(
    "check_inbox",
    {
      title: "Check Inbox",
      description:
        "Return token-aware inbox previews only. Full body, snippets, and payload values are excluded.",
      inputSchema: checkInboxInputSchema.shape
    },
    async (input) => toToolResult(await checkInbox(store, input))
  );

  server.registerTool(
    "read_context",
    {
      title: "Read Context",
      description:
        "Read one Context Package addressed to the given mailbox and mark it as read.",
      inputSchema: readContextInputSchema.shape
    },
    async (input) => toToolResult(await readContext(store, input))
  );

  server.registerTool(
    "ack_context",
    {
      title: "Acknowledge Context",
      description:
        "Acknowledge one Context Package addressed to the given mailbox. Ack means loaded/seen, not completed.",
      inputSchema: ackContextInputSchema.shape
    },
    async (input) => toToolResult(await ackContext(store, input))
  );

  return server;
}

export async function runCimuxMcpServer(databasePath?: string): Promise<void> {
  const server = createCimuxMcpServer(databasePath);
  await server.connect(new StdioServerTransport());
}

export function defaultDatabasePath(): string {
  return path.join(os.homedir(), ".cimux", "cimux.sqlite");
}

function toToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
