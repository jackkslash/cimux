import { createSessionBrief } from "../../service/cimux-mailbox-service.js";
import { resolveRuntimeMailboxFromArgs, withStore } from "../shared.js";
import type { CommandContext } from "../shared.js";

export async function runBriefCommand(context: CommandContext): Promise<number> {
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
