import { runCimuxMcpServer } from "../../mcp/cimux-mcp-server.js";
import type { CommandSpec } from "../shared.js";

export const mcpCommand: CommandSpec = {
  name: "mcp",
  usage: "cimux mcp",
  options: {},
  async run(context) {
    await runCimuxMcpServer(context.env.CIMUX_DB_PATH);
    return 0;
  }
};
