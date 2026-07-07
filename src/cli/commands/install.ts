import { applyInstallPlan, createInstallPlan } from "../../install/cimux-install-plan.js";
import { resolvePackageCommand } from "../shared.js";
import type { CommandSpec } from "../shared.js";

export const installCommand: CommandSpec = {
  name: "install",
  usage: "cimux install [--dry-run]",
  options: {
    "dry-run": { type: "boolean" }
  },
  run(context) {
    const plan = createInstallPlan({ packageCommand: resolvePackageCommand() });
    if (context.values["dry-run"] !== true) {
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
};
