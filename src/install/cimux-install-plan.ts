import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
  AGENT_NORMS_MARKER,
  createAgentNormsSnippet,
  createHookSnippet,
  HARNESS_DESCRIPTORS,
  HOOKS_PURPOSE,
  SUPPORTED_HARNESSES
} from "./harnesses/index.js";
import type { HarnessDescriptor, HarnessName } from "./harnesses/index.js";

export const installPlanInputSchema = z.object({
  packageCommand: z.string().min(1).default("cimux"),
  homeDirectory: z.string().min(1).default(os.homedir()),
  harnesses: z.array(z.enum(SUPPORTED_HARNESSES)).min(1).optional()
});

export type InstallPlanInput = z.input<typeof installPlanInputSchema>;

export type InstallPlanTarget = {
  harness: HarnessName;
  path: string;
  purpose: string;
  format: "toml" | "json" | "markdown";
  snippet: string;
};

export type InstallPlan = {
  targets: InstallPlanTarget[];
};

export type InstallResult = {
  path: string;
  status: "created" | "updated" | "unchanged";
  backupPath: string | null;
};

export function createInstallPlan(input: InstallPlanInput = {}): InstallPlan {
  const parsed = installPlanInputSchema.parse(input);
  const selected = HARNESS_DESCRIPTORS.filter(
    (descriptor) => !parsed.harnesses || parsed.harnesses.includes(descriptor.name)
  );

  return {
    targets: selected.flatMap((descriptor) =>
      createHarnessTargets(descriptor, parsed.homeDirectory, parsed.packageCommand)
    )
  };
}

function createHarnessTargets(
  descriptor: HarnessDescriptor,
  homeDirectory: string,
  packageCommand: string
): InstallPlanTarget[] {
  const targets: InstallPlanTarget[] = [
    {
      harness: descriptor.name,
      path: path.join(homeDirectory, descriptor.mcp.path),
      purpose: descriptor.mcp.purpose,
      format: descriptor.mcp.format,
      snippet: descriptor.mcp.snippet(packageCommand)
    }
  ];

  if (descriptor.hooks) {
    const snippet = descriptor.hooks.snippet ?? createHookSnippet;
    targets.push({
      harness: descriptor.name,
      path: path.join(homeDirectory, descriptor.hooks.path),
      purpose: descriptor.hooks.purpose ?? HOOKS_PURPOSE,
      format: "json",
      snippet: snippet(packageCommand, descriptor.name)
    });
  }

  if (descriptor.norms) {
    const snippet = descriptor.norms.snippet ?? createAgentNormsSnippet;
    targets.push({
      harness: descriptor.name,
      path: path.join(homeDirectory, descriptor.norms.path),
      purpose: descriptor.norms.purpose,
      format: "markdown",
      snippet: snippet()
    });
  }

  return targets;
}

export function applyInstallPlan(plan: InstallPlan): InstallResult[] {
  return plan.targets.map((target) => applyInstallTarget(target));
}

function applyInstallTarget(target: InstallPlanTarget): InstallResult {
  fs.mkdirSync(path.dirname(target.path), { recursive: true });

  if (target.format === "toml") {
    return applyTomlTarget(target);
  }

  if (target.format === "markdown") {
    return applyMarkdownTarget(target);
  }

  return applyJsonTarget(target);
}

function applyTomlTarget(target: InstallPlanTarget): InstallResult {
  const existing = readTextIfExists(target.path);
  if (existing?.includes("[mcp_servers.cimux]")) {
    // Refresh the command line in place (the cimux binary path changes when
    // Node or the install location does) while keeping any user additions
    // to the block, such as timeouts or env.
    const refreshed = refreshCimuxTomlCommand(existing, target.snippet);
    if (refreshed === existing) {
      return {
        path: target.path,
        status: "unchanged",
        backupPath: null
      };
    }

    const backupPath = writeBackup(target.path, existing);
    fs.writeFileSync(target.path, refreshed, "utf8");
    return {
      path: target.path,
      status: "updated",
      backupPath
    };
  }

  const backupPath = existing === null ? null : writeBackup(target.path, existing);
  const next = existing === null ? target.snippet : appendBlock(existing, target.snippet);
  fs.writeFileSync(target.path, next, "utf8");

  return {
    path: target.path,
    status: existing === null ? "created" : "updated",
    backupPath
  };
}

function applyMarkdownTarget(target: InstallPlanTarget): InstallResult {
  const existing = readTextIfExists(target.path);
  if (existing?.includes(AGENT_NORMS_MARKER)) {
    return {
      path: target.path,
      status: "unchanged",
      backupPath: null
    };
  }

  const backupPath = existing === null ? null : writeBackup(target.path, existing);
  const next = existing === null ? target.snippet : appendBlock(existing, target.snippet);
  fs.writeFileSync(target.path, next, "utf8");

  return {
    path: target.path,
    status: existing === null ? "created" : "updated",
    backupPath
  };
}

function applyJsonTarget(target: InstallPlanTarget): InstallResult {
  const existingText = readTextIfExists(target.path);
  const existingValue = existingText === null ? {} : parseJsonObject(existingText, target.path);
  const snippetValue = parseJsonObject(target.snippet, target.path);
  const mergedValue = mergeJson(existingValue, snippetValue);
  const nextText = `${JSON.stringify(mergedValue, null, 2)}\n`;

  if (existingText === nextText) {
    return {
      path: target.path,
      status: "unchanged",
      backupPath: null
    };
  }

  const backupPath = existingText === null ? null : writeBackup(target.path, existingText);
  fs.writeFileSync(target.path, nextText, "utf8");

  return {
    path: target.path,
    status: existingText === null ? "created" : "updated",
    backupPath
  };
}

function mergeJson(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const merged: Record<string, unknown> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    const existingValue = merged[key];
    if (isPlainObject(existingValue) && isPlainObject(incomingValue)) {
      merged[key] = mergeJson(existingValue, incomingValue);
    } else if (Array.isArray(existingValue) && Array.isArray(incomingValue)) {
      merged[key] = mergeArray(existingValue, incomingValue);
    } else {
      merged[key] = incomingValue;
    }
  }

  return merged;
}

function mergeArray(existing: unknown[], incoming: unknown[]): unknown[] {
  // Keys canonicalize cimux commands so a hook entry whose binary path moved
  // (nvm upgrades, dev builds) is replaced instead of duplicated. Entries
  // that are not cimux commands keep exact-content identity.
  const merged = [...existing];
  const keys = merged.map((item) => stableStringify(canonicalizeCimuxCommands(item)));

  for (const item of incoming) {
    const key = stableStringify(canonicalizeCimuxCommands(item));
    const at = keys.indexOf(key);
    if (at >= 0) {
      merged[at] = item;
    } else {
      merged.push(item);
      keys.push(key);
    }
  }

  return merged;
}

const CIMUX_COMMAND_PATTERN = /^\S*(?:cimux|bin\.js)\s+(?=notify|brief|mcp\b)/;

function canonicalizeCimuxCommands(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeCimuxCommands);
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "command" && typeof entry === "string") {
        result[key] = entry.replace(CIMUX_COMMAND_PATTERN, "cimux ");
      } else {
        result[key] = canonicalizeCimuxCommands(entry);
      }
    }
    return result;
  }

  return value;
}

function refreshCimuxTomlCommand(existing: string, snippet: string): string {
  const desired = snippet.match(/^command = .*$/m)?.[0];
  if (!desired) {
    return existing;
  }

  // Only touch the command line inside the cimux block; [^[]*? stops the
  // match from crossing into the next TOML table.
  return existing.replace(
    /(\[mcp_servers\.cimux\][^[]*?)^command = .*$/m,
    (_match, prefix: string) => `${prefix}${desired}`
  );
}

function readTextIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf8");
}

function parseJsonObject(value: string, filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!isPlainObject(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }

  return parsed;
}

function writeBackup(filePath: string, content: string): string {
  const backupPath = `${filePath}.cimux.bak`;
  fs.writeFileSync(backupPath, content, "utf8");
  return backupPath;
}

function appendBlock(existing: string, block: string): string {
  const trimmed = existing.trimEnd();
  return `${trimmed}\n\n${block}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (!isPlainObject(value)) {
    return JSON.stringify(value);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }

  return JSON.stringify(sorted);
}
