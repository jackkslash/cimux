import { readContext } from "../../service/cimux-mailbox-service.js";
import { requireString, withStore, writeJson } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const readCommand: CommandSpec = {
  name: "read",
  usage: "cimux read --mailbox <harness/name> --id <context-id>",
  options: {
    mailbox: { type: "string" },
    id: { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      const result = await readContext(store, {
        mailbox: requireString(context.values, "mailbox"),
        id: requireString(context.values, "id")
      });
      writeJson(context.io, result);
      return 0;
    });
  }
};
