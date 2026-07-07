import { listMailboxes } from "../../service/cimux-mailbox-service.js";
import { withStore, writeJson } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runMailboxesCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    writeJson(context.io, await listMailboxes(store));
    return 0;
  });
}
