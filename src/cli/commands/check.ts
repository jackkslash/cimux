import { checkInbox } from "../../service/cimux-mailbox-service.js";
import { requireArg, withStore, writeJson } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runCheckCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const result = await checkInbox(store, {
      mailbox: requireArg(context.argv, "--mailbox"),
      unreadOnly: !context.argv.includes("--all")
    });
    writeJson(context.io, result);
    return 0;
  });
}
