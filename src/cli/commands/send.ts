import type { CreateContextPackageInput } from "../../model/context-package.js";
import { sendContext } from "../../service/cimux-mailbox-service.js";
import { readCsv, readJson, requireString, withStore, writeJson } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const sendCommand: CommandSpec = {
  name: "send",
  usage:
    "cimux send --from <mailbox> --to <mailbox> --title <title> --summary <summary> --body <body> [--tags a,b] [--artifacts-json <json>] [--payload-json <json>]",
  options: {
    from: { type: "string" },
    to: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    body: { type: "string" },
    tags: { type: "string" },
    "artifacts-json": { type: "string" },
    "payload-json": { type: "string" }
  },
  run(context) {
    return withStore(context.env, async (store) => {
      // The JSON flags are parsed here and validated by the service schemas,
      // so malformed artifacts fail with a schema error, not a crash.
      const artifacts = readJson(context.values, "artifacts-json") ?? {};
      const payload = readJson(context.values, "payload-json") ?? {};

      const result = await sendContext(store, {
        fromMailbox: requireString(context.values, "from"),
        toMailbox: requireString(context.values, "to"),
        title: requireString(context.values, "title"),
        summary: requireString(context.values, "summary"),
        body: requireString(context.values, "body"),
        tags: readCsv(context.values, "tags"),
        artifacts: artifacts as CreateContextPackageInput["artifacts"],
        payload: payload as CreateContextPackageInput["payload"]
      });
      writeJson(context.io, result);
      return 0;
    });
  }
};
