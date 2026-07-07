import { listMailboxes } from "../../service/cimux-mailbox-service.js";
import { withStore, writeJson } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const mailboxesCommand: CommandSpec = {
  name: "mailboxes",
  usage: "cimux mailboxes",
  options: {},
  run(context) {
    return withStore(context.env, async (store) => {
      writeJson(context.io, await listMailboxes(store));
      return 0;
    });
  }
};
