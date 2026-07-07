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

// Flag values as produced by node:util parseArgs (no multiples configured).
export type ParsedValues = Record<string, string | boolean | undefined>;

// Everything a command needs, so command modules share one signature.
export type CommandContext = {
  values: ParsedValues;
  env: CimuxCliEnv;
  cwd: string;
  io: CimuxCliIo;
};

// Each command declares its flags once; parsing, strict unknown-flag
// errors, and the usage listing are all derived from this.
export type CommandSpec = {
  name: string;
  usage: string;
  options: Record<string, { type: "string" | "boolean" }>;
  run(context: CommandContext): number | Promise<number>;
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
  const explicitMailbox = readString(context.values, "mailbox") ?? context.env.CIMUX_MAILBOX;
  const harness = readString(context.values, "harness") ?? context.env.CIMUX_HARNESS;
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

export function readString(values: ParsedValues, name: string): string | undefined {
  const value = values[name];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function requireString(values: ParsedValues, name: string): string {
  const value = readString(values, name);
  if (value === undefined) {
    throw new Error(`Expected --${name}`);
  }

  return value;
}

export function readCsv(values: ParsedValues, name: string): string[] {
  const value = readString(values, name);
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readJson(values: ParsedValues, name: string): unknown {
  const value = readString(values, name);
  if (value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON for --${name}`);
  }
}

export function writeJson(io: CimuxCliIo, value: unknown): void {
  io.log(JSON.stringify(value, null, 2));
}
