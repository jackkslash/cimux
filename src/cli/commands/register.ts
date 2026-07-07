import { registerSession } from "../../service/cimux-mailbox-service.js";
import {
  readString,
  resolveRuntimeMailboxFromArgs,
  withStore,
  writeJson
} from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const registerCommand: CommandSpec = {
  name: "register",
  usage: "cimux register [--mailbox <harness/name> | --harness <name>]",
  options: {
    mailbox: { type: "string" },
    harness: { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      const mailbox = resolveRuntimeMailboxFromArgs(context);
      const result = await registerSession(store, {
        harness:
          readString(context.values, "harness") ?? context.env.CIMUX_HARNESS ?? "codex",
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
};
