import { name, version } from "../version.js";
import { runAckCommand } from "./commands/ack.js";
import { runBriefCommand } from "./commands/brief.js";
import { runCheckCommand } from "./commands/check.js";
import { runInstallCommand } from "./commands/install.js";
import { runMailboxesCommand } from "./commands/mailboxes.js";
import { runMcpCommand } from "./commands/mcp.js";
import { runNotifyCommand } from "./commands/notify.js";
import { runReadCommand } from "./commands/read.js";
import { runRegisterCommand } from "./commands/register.js";
import { runSendCommand } from "./commands/send.js";
import type { CimuxCliEnv, CimuxCliIo, CommandContext } from "./shared.js";

export type { CimuxCliEnv, CimuxCliIo } from "./shared.js";

const commands: Record<string, (context: CommandContext) => number | Promise<number>> = {
  mcp: runMcpCommand,
  notify: runNotifyCommand,
  brief: runBriefCommand,
  mailboxes: runMailboxesCommand,
  install: runInstallCommand,
  register: runRegisterCommand,
  send: runSendCommand,
  check: runCheckCommand,
  read: runReadCommand,
  ack: runAckCommand
};

export async function runCimuxCli(
  argv: string[],
  env: CimuxCliEnv = process.env,
  cwd = process.cwd(),
  io: CimuxCliIo = console
): Promise<number> {
  const command = argv[0];

  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      io.log(usage());
      return 0;
    }

    if (command === "version" || command === "--version" || command === "-v") {
      io.log(`${name} ${version}`);
      return 0;
    }

    const run = commands[command];
    if (!run) {
      io.error(usage());
      return 1;
    }

    return await run({ argv, env, cwd, io });
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function usage(): string {
  return [
    `${name} ${version}`,
    "",
    "Local-first mailboxes for intentional AI agent context handoffs.",
    "",
    "Usage:",
    "  cimux mcp",
    "  cimux install [--dry-run]",
    "  cimux notify [--mailbox <harness/name> | --harness <name>]",
    "  cimux brief [--mailbox <harness/name> | --harness <name>]",
    "  cimux register [--mailbox <harness/name> | --harness <name>]",
    "  cimux mailboxes",
    "  cimux send --from <mailbox> --to <mailbox> --title <title> --summary <summary> --body <body> [--tags a,b]",
    "  cimux check --mailbox <harness/name> [--all]",
    "  cimux read --mailbox <harness/name> --id <context-id>",
    "  cimux ack --mailbox <harness/name> --id <context-id> [--note <note>]",
    "",
    "Examples:",
    "  cimux install --dry-run",
    "  cimux notify --harness codex",
    "  cimux check --mailbox claude/frontend-login"
  ].join("\n");
}
