import { readContext } from "../../service/cimux-mailbox-service.js";
import { requireArg, withStore, writeJson } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runReadCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const result = await readContext(store, {
      mailbox: requireArg(context.argv, "--mailbox"),
      id: requireArg(context.argv, "--id")
    });
    writeJson(context.io, result);
    return 0;
  });
}
