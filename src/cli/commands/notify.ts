import { createInboxNotification } from "../../service/cimux-mailbox-service.js";
import { resolveRuntimeMailboxFromArgs, withStore } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const notifyCommand: CommandSpec = {
  name: "notify",
  usage: "cimux notify [--mailbox <harness/name> | --harness <name>]",
  options: {
    mailbox: { type: "string" },
    harness: { type: "string" }
  },
  run(context) {
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
};
