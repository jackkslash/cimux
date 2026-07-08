import { createSessionBrief } from "../../service/cimux-mailbox-service.js";
import { readString, resolveRuntimeMailboxFromArgs, withStore } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const briefCommand: CommandSpec = {
  name: "brief",
  usage: "cimux brief [--mailbox <harness/name> | --harness <name>] [--format text|cursor]",
  options: {
    mailbox: { type: "string" },
    harness: { type: "string" },
    format: { type: "string" }
  },
  run(context) {
    const format = readString(context.values, "format") ?? "text";
    if (format !== "text" && format !== "cursor") {
      throw new Error(`Unknown format: ${format} (supported: text, cursor)`);
    }

    return withStore(context.env, async (store) => {
      const { mailbox } = resolveRuntimeMailboxFromArgs(context);

      // Runs from a SessionStart hook: register the session's mailbox, then
      // print the norms so agents use Cimux without being prompted.
      await store.createMailbox(mailbox);
      const result = await createSessionBrief(store, { mailbox });

      // Cursor hooks reply with JSON on stdout instead of plain text.
      if (format === "cursor") {
        context.io.log(JSON.stringify({ additional_context: result.message }));
      } else {
        context.io.log(result.message);
      }
      return 0;
    });
  }
};
