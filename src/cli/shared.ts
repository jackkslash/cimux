import path from "node:path";
import { defaultDatabasePath } from "../mcp/cimux-mcp-server.js";
import { resolveRuntimeMailbox } from "../naming/mailbox-naming.js";
import type { RuntimeMailboxResult } from "../naming/mailbox-naming.js";
import { SQLiteCimuxStore } from "../storage/sqlite-cimux-store.js";

export type CimuxCliIo = {
  log(message: string): void;
  error(message: string): void;
};

export type CimuxCliEnv = {
  CIMUX_DB_PATH?: string;
  CIMUX_MAILBOX?: string;
  CIMUX_HARNESS?: string;
};

// Everything a command needs, so command modules share one signature.
export type CommandContext = {
  argv: string[];
  env: CimuxCliEnv;
  cwd: string;
  io: CimuxCliIo;
};

export async function withStore(
  env: CimuxCliEnv,
  callback: (store: SQLiteCimuxStore) => Promise<number>
): Promise<number> {
  const store = new SQLiteCimuxStore(env.CIMUX_DB_PATH ?? defaultDatabasePath());
  try {
    return await callback(store);
  } finally {
    store.close();
  }
}

export function resolveRuntimeMailboxFromArgs(
  context: CommandContext
): RuntimeMailboxResult {
  const explicitMailbox = readArg(context.argv, "--mailbox") ?? context.env.CIMUX_MAILBOX;
  const harness = readArg(context.argv, "--harness") ?? context.env.CIMUX_HARNESS;
  if (!explicitMailbox && !harness) {
    throw new Error("Expected --mailbox <harness/name> or --harness <name>");
  }

  return resolveRuntimeMailbox({
    ...(explicitMailbox === undefined ? {} : { explicitMailbox }),
    ...(harness === undefined ? {} : { harness }),
    cwd: context.cwd
  });
}

export function resolvePackageCommand(): string {
  // GUI-launched harnesses (e.g. the Codex desktop app) do not inherit the
  // shell PATH, so write the absolute path of the running bin into config.
  const binPath = process.argv[1];
  return binPath && path.isAbsolute(binPath) ? binPath : "cimux";
}

export function readArg(argv: string[], name: string): string | undefined {
  const exact = argv.indexOf(name);
  if (exact >= 0) {
    return argv[exact + 1];
  }

  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed?.slice(name.length + 1);
}

export function requireArg(argv: string[], name: string): string {
  const value = readArg(argv, name);
  if (!value) {
    throw new Error(`Expected ${name}`);
  }

  return value;
}

export function readCsvArg(argv: string[], name: string): string[] {
  const value = readArg(argv, name);
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function writeJson(io: CimuxCliIo, value: unknown): void {
  io.log(JSON.stringify(value, null, 2));
}
