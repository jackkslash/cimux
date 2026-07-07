import { registerSession } from "../../service/cimux-mailbox-service.js";
import {
  readArg,
  resolveRuntimeMailboxFromArgs,
  withStore,
  writeJson
} from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runRegisterCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const mailbox = resolveRuntimeMailboxFromArgs(context);
    const result = await registerSession(store, {
      harness: readArg(context.argv, "--harness") ?? context.env.CIMUX_HARNESS ?? "codex",
      ...(mailbox.inferredFrom === "explicit"
        ? { explicitMailbox: mailbox.mailbox }
        : {
            branchName: mailbox.branchName ?? undefined,
            folderName: mailbox.folderName
          })
    });
    writeJson(context.io, result);
    return 0;
  });
}
