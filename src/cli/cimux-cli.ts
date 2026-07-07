import path from "node:path";
import { applyInstallPlan, createInstallPlan } from "../install/cimux-install-plan.js";
import { defaultDatabasePath, runCimuxMcpServer } from "../mcp/cimux-mcp-server.js";
import { resolveRuntimeMailbox } from "../runtime/mailbox-runtime.js";
import {
  ackContext,
  checkInbox,
  createInboxNotification,
  createSessionBrief,
  listMailboxes,
  readContext,
  registerSession,
  sendContext
} from "../service/cimux-mailbox-service.js";
import { SQLiteCimuxStore } from "../storage/sqlite-cimux-store.js";
import { name, version } from "../version.js";

export type CimuxCliIo = {
  log(message: string): void;
  error(message: string): void;
};

export type CimuxCliEnv = {
  CIMUX_DB_PATH?: string;
  CIMUX_MAILBOX?: string;
  CIMUX_HARNESS?: string;
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

    if (command === "mcp") {
      await runCimuxMcpServer(env.CIMUX_DB_PATH);
      return 0;
    }

    if (command === "notify") {
      return await runNotifyCommand(argv, env, cwd, io);
    }

    if (command === "brief") {
      return await runBriefCommand(argv, env, cwd, io);
    }

    if (command === "mailboxes") {
      return await withStore(env, async (store) => {
        writeJson(io, await listMailboxes(store));
        return 0;
      });
    }

    if (command === "install") {
      return runInstallCommand(argv, io);
    }

    if (command === "register") {
      return await withStore(env, async (store) => {
        const mailbox = resolveRuntimeMailboxFromArgs(argv, env, cwd);
        const result = await registerSession(store, {
          harness: readArg(argv, "--harness") ?? env.CIMUX_HARNESS ?? "codex",
          ...(mailbox.inferredFrom === "explicit"
            ? { explicitMailbox: mailbox.mailbox }
            : {
                branchName: mailbox.branchName ?? undefined,
                folderName: mailbox.folderName
              })
        });
        writeJson(io, result);
        return 0;
      });
    }

    if (command === "send") {
      return await withStore(env, async (store) => {
        const result = await sendContext(store, {
          fromMailbox: requireArg(argv, "--from"),
          toMailbox: requireArg(argv, "--to"),
          title: requireArg(argv, "--title"),
          summary: requireArg(argv, "--summary"),
          body: requireArg(argv, "--body"),
          tags: readCsvArg(argv, "--tags"),
          artifacts: {},
          payload: {}
        });
        writeJson(io, result);
        return 0;
      });
    }

    if (command === "check") {
      return await withStore(env, async (store) => {
        const result = await checkInbox(store, {
          mailbox: requireArg(argv, "--mailbox"),
          unreadOnly: !argv.includes("--all")
        });
        writeJson(io, result);
        return 0;
      });
    }

    if (command === "read") {
      return await withStore(env, async (store) => {
        const result = await readContext(store, {
          mailbox: requireArg(argv, "--mailbox"),
          id: requireArg(argv, "--id")
        });
        writeJson(io, result);
        return 0;
      });
    }

    if (command === "ack") {
      return await withStore(env, async (store) => {
        const note = readArg(argv, "--note");
        const result = await ackContext(store, {
          mailbox: requireArg(argv, "--mailbox"),
          id: requireArg(argv, "--id"),
          ...(note === undefined ? {} : { note })
        });
        writeJson(io, result);
        return 0;
      });
    }

    io.error(usage());
    return 1;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runNotifyCommand(
  argv: string[],
  env: CimuxCliEnv,
  cwd: string,
  io: CimuxCliIo
): Promise<number> {
  return withStore(env, async (store) => {
    const { mailbox } = resolveRuntimeMailboxFromArgs(argv, env, cwd);

    // Hook checks also act as a heartbeat for the current local session name.
    // Creation is idempotent, so this does not reset existing mailbox state.
    await store.createMailbox(mailbox);
    const result = await createInboxNotification(store, { mailbox });
    if (result.message) {
      io.log(result.message);
    }
    return 0;
  });
}

async function runBriefCommand(
  argv: string[],
  env: CimuxCliEnv,
  cwd: string,
  io: CimuxCliIo
): Promise<number> {
  return withStore(env, async (store) => {
    const { mailbox } = resolveRuntimeMailboxFromArgs(argv, env, cwd);

    // Runs from a SessionStart hook: register the session's mailbox, then
    // print the norms so agents use Cimux without being prompted.
    await store.createMailbox(mailbox);
    const result = await createSessionBrief(store, { mailbox });
    io.log(result.message);
    return 0;
  });
}

function runInstallCommand(argv: string[], io: CimuxCliIo): number {
  const plan = createInstallPlan({ packageCommand: resolvePackageCommand() });
  if (!argv.includes("--dry-run")) {
    const results = applyInstallPlan(plan);
    for (const result of results) {
      const backup = result.backupPath ? ` backup: ${result.backupPath}` : "";
      io.log(`${result.status}: ${result.path}${backup}`);
    }
    return 0;
  }

  for (const target of plan.targets) {
    io.log(`# ${target.harness}: ${target.path}`);
    io.log(`# ${target.purpose}`);
    io.log(target.snippet);
  }
  return 0;
}

function resolvePackageCommand(): string {
  // GUI-launched harnesses (e.g. the Codex desktop app) do not inherit the
  // shell PATH, so write the absolute path of the running bin into config.
  const binPath = process.argv[1];
  return binPath && path.isAbsolute(binPath) ? binPath : "cimux";
}

async function withStore(
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

function resolveRuntimeMailboxFromArgs(
  argv: string[],
  env: CimuxCliEnv,
  cwd: string
) {
  const explicitMailbox = readArg(argv, "--mailbox") ?? env.CIMUX_MAILBOX;
  const harness = readArg(argv, "--harness") ?? env.CIMUX_HARNESS;
  if (!explicitMailbox && !harness) {
    throw new Error("Expected --mailbox <harness/name> or --harness <name>");
  }

  return resolveRuntimeMailbox({
    ...(explicitMailbox === undefined ? {} : { explicitMailbox }),
    ...(harness === undefined ? {} : { harness }),
    cwd
  });
}

function readArg(argv: string[], name: string): string | undefined {
  const exact = argv.indexOf(name);
  if (exact >= 0) {
    return argv[exact + 1];
  }

  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed?.slice(name.length + 1);
}

function requireArg(argv: string[], name: string): string {
  const value = readArg(argv, name);
  if (!value) {
    throw new Error(`Expected ${name}`);
  }

  return value;
}

function readCsvArg(argv: string[], name: string): string[] {
  const value = readArg(argv, name);
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function writeJson(io: CimuxCliIo, value: unknown): void {
  io.log(JSON.stringify(value, null, 2));
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
