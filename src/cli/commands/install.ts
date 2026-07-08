import { applyInstallPlan, createInstallPlan } from "../../install/cimux-install-plan.js";
import {
  detectInstalledHarnesses,
  SUPPORTED_HARNESSES
} from "../../install/harnesses/index.js";
import type { HarnessName } from "../../install/harnesses/index.js";
import { readString, resolvePackageCommand } from "../shared.js";
import type { CommandContext, CommandSpec } from "../shared.js";

export const installCommand: CommandSpec = {
  name: "install",
  usage: "cimux install [--dry-run] [--all | --harness <name>]",
  options: {
    "dry-run": { type: "boolean" },
    all: { type: "boolean" },
    harness: { type: "string" }
  },
  run(context) {
    const harnesses = selectHarnesses(context);
    if (harnesses !== undefined && harnesses.length === 0) {
      context.io.error(
        `No supported harnesses detected (looked for ${SUPPORTED_HARNESSES.map(
          (name) => `~/.${name}`
        ).join(", ")}). Use --all to write config for every supported harness.`
      );
      return 1;
    }

    const plan = createInstallPlan({
      packageCommand: resolvePackageCommand(),
      ...(harnesses === undefined ? {} : { harnesses })
    });

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

// undefined means "no filter": --all installs every supported harness.
function selectHarnesses(context: CommandContext): HarnessName[] | undefined {
  const harness = readString(context.values, "harness");
  if (harness !== undefined) {
    if (!isHarnessName(harness)) {
      throw new Error(
        `Unknown harness: ${harness} (supported: ${SUPPORTED_HARNESSES.join(", ")})`
      );
    }
    return [harness];
  }

  if (context.values.all === true) {
    return undefined;
  }

  return detectInstalledHarnesses();
}

function isHarnessName(value: string): value is HarnessName {
  return (SUPPORTED_HARNESSES as readonly string[]).includes(value);
}
