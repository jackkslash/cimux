import { createInboxNotification } from "../../service/cimux-mailbox-service.js";
import { resolveRuntimeMailboxFromArgs, withStore } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runNotifyCommand(context: CommandContext): Promise<number> {
  return withStore(context.env, async (store) => {
    const { mailbox } = resolveRuntimeMailboxFromArgs(context);

    // Hook checks also act as a heartbeat for the current local session name.
    // Creation is idempotent, so this does not reset existing mailbox state.
    await store.createMailbox(mailbox);
    const result = await createInboxNotification(store, { mailbox });
    if (result.message) {
      context.io.log(result.message);
    }
    return 0;
  });
}
