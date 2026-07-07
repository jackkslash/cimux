import { ackContext } from "../../service/cimux-mailbox-service.js";
import { readString, requireString, withStore, writeJson } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const ackCommand: CommandSpec = {
  name: "ack",
  usage: "cimux ack --mailbox <harness/name> --id <context-id> [--note <note>]",
  options: {
    mailbox: { type: "string" },
    id: { type: "string" },
    note: { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      const note = readString(context.values, "note");
      const result = await ackContext(store, {
        mailbox: requireString(context.values, "mailbox"),
        id: requireString(context.values, "id"),
        ...(note === undefined ? {} : { note })
      });
      writeJson(context.io, result);
      return 0;
    });
  }
};
