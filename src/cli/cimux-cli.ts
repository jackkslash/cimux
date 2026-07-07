import { parseArgs } from "node:util";
import { ZodError } from "zod";
import { name, version } from "../version.js";
import { ackCommand } from "./commands/ack.js";
import { briefCommand } from "./commands/brief.js";
import { checkCommand } from "./commands/check.js";
import { installCommand } from "./commands/install.js";
import { mailboxesCommand } from "./commands/mailboxes.js";
import { mcpCommand } from "./commands/mcp.js";
import { notifyCommand } from "./commands/notify.js";
import { readCommand } from "./commands/read.js";
import { registerCommand } from "./commands/register.js";
import { sendCommand } from "./commands/send.js";
import type { CimuxCliEnv, CimuxCliIo, CommandSpec, ParsedValues } from "./shared.js";

export type { CimuxCliEnv, CimuxCliIo } from "./shared.js";

const commands: CommandSpec[] = [
  mcpCommand,
  installCommand,
  notifyCommand,
  briefCommand,
  registerCommand,
  mailboxesCommand,
  sendCommand,
  checkCommand,
  readCommand,
  ackCommand
];

export async function runCimuxCli(
  argv: string[],
  env: CimuxCliEnv = process.env,
  cwd = process.cwd(),
  io: CimuxCliIo = console
): Promise<number> {
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    io.log(usage());
    return 0;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    io.log(`${name} ${version}`);
    return 0;
  }

  const spec = commands.find((candidate) => candidate.name === command);
  if (!spec) {
    io.error(`Unknown command: ${command}`);
    io.error("");
    io.error(usage());
    return 1;
  }

  let values: ParsedValues;
  try {
    // strict mode rejects unknown flags and flags missing their value, so
    // typos fail loudly instead of being silently swallowed.
    values = parseArgs({
      args: argv.slice(1),
      options: spec.options,
      strict: true,
      allowPositionals: false
    }).values as ParsedValues;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    io.error(`Usage: ${spec.usage}`);
    return 1;
  }

  try {
    return await spec.run({ values, env, cwd, io });
  } catch (error) {
    if (error instanceof ZodError) {
      io.error("Invalid input:");
      for (const issue of error.issues) {
        const flag = issue.path.length > 0 ? `--${issue.path.join(".")}` : "input";
        io.error(`  ${flag}: ${issue.message}`);
      }
      io.error(`Usage: ${spec.usage}`);
      return 1;
    }

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
    ...commands.map((spec) => `  ${spec.usage}`),
    "",
    "Examples:",
    "  cimux install --dry-run",
    "  cimux notify --harness codex",
    "  cimux check --mailbox claude/frontend-login"
  ].join("\n");
}
