import { sendContext } from "../../service/cimux-mailbox-service.js";
import { readCsvArg, requireArg, withStore, writeJson } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runSendCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const result = await sendContext(store, {
      fromMailbox: requireArg(context.argv, "--from"),
      toMailbox: requireArg(context.argv, "--to"),
      title: requireArg(context.argv, "--title"),
      summary: requireArg(context.argv, "--summary"),
      body: requireArg(context.argv, "--body"),
      tags: readCsvArg(context.argv, "--tags"),
      artifacts: {},
      payload: {}
    });
    writeJson(context.io, result);
    return 0;
  });
}
