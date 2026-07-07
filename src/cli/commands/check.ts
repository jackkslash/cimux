import { checkInbox } from "../../service/cimux-mailbox-service.js";
import { readString, requireString, withStore, writeJson } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const checkCommand: CommandSpec = {
  name: "check",
  usage: "cimux check --mailbox <harness/name> [--all] [--limit <n>]",
  options: {
    mailbox: { type: "string" },
    all: { type: "boolean" },
    limit: { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      const limit = readString(context.values, "limit");
      const result = await checkInbox(store, {
        mailbox: requireString(context.values, "mailbox"),
        unreadOnly: context.values.all !== true,
        ...(limit === undefined ? {} : { limit: Number(limit) })
      });
      writeJson(context.io, result);
      return 0;
    });
  }
};
