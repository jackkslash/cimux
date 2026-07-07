import { applyInstallPlan, createInstallPlan } from "../../install/cimux-install-plan.js";
import { resolvePackageCommand } from "../shared.js";
import type { CommandContext } from "../shared.js";

export function runInstallCommand(context: CommandContext): number {
  const plan = createInstallPlan({ packageCommand: resolvePackageCommand() });
  if (!context.argv.includes("--dry-run")) {
    const results = applyInstallPlan(plan);
    for (const result of results) {
      const backup = result.backupPath ? ` backup: ${result.backupPath}` : "";
      context.io.log(`${result.status}: ${result.path}${backup}`);
    }
    return 0;
  }

  for (const target of plan.targets) {
    context.io.log(`# ${target.harness}: ${target.path}`);
    context.io.log(`# ${target.purpose}`);
    context.io.log(target.snippet);
  }
  return 0;
}
