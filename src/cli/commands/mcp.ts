import { runCimuxMcpServer } from "../../mcp/cimux-mcp-server.js";
import type { CommandContext } from "../shared.js";

export async function runMcpCommand(context: CommandContext): Promise<number> {
  await runCimuxMcpServer(context.env.CIMUX_DB_PATH);
  return 0;
}
