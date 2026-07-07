import { createSessionBrief } from "../../service/cimux-mailbox-service.js";
import { resolveRuntimeMailboxFromArgs, withStore } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const briefCommand: CommandSpec = {
  name: "brief",
  usage: "cimux brief [--mailbox <harness/name> | --harness <name>]",
  options: {
    mailbox: { type: "string" },
    harness: { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      const { mailbox } = resolveRuntimeMailboxFromArgs(context);

      // Runs from a SessionStart hook: register the session's mailbox, then
      // print the norms so agents use Cimux without being prompted.
      await store.createMailbox(mailbox);
      const result = await createSessionBrief(store, { mailbox });
      context.io.log(result.message);
      return 0;
    });
  }
};
