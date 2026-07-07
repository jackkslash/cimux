import { ackContext } from "../../service/cimux-mailbox-service.js";
import { readArg, requireArg, withStore, writeJson } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runAckCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const note = readArg(context.argv, "--note");
    const result = await ackContext(store, {
      mailbox: requireArg(context.argv, "--mailbox"),
      id: requireArg(context.argv, "--id"),
      ...(note === undefined ? {} : { note })
    });
    writeJson(context.io, result);
    return 0;
  });
}
