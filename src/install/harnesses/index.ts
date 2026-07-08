import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeHarness } from "./claude.js";
import { codexHarness } from "./codex.js";
import type { HarnessDescriptor, HarnessName } from "./shared.js";

export const HARNESS_DESCRIPTORS: HarnessDescriptor[] = [codexHarness, claudeHarness];

export {
  AGENT_NORMS_MARKER,
  createAgentNormsSnippet,
  createHookSnippet,
  HOOKS_PURPOSE,
  SUPPORTED_HARNESSES
} from "./shared.js";
export type { HarnessDescriptor, HarnessName } from "./shared.js";

export function detectInstalledHarnesses(homeDirectory = os.homedir()): HarnessName[] {
  return HARNESS_DESCRIPTORS.filter((descriptor) =>
    fs.existsSync(path.join(homeDirectory, descriptor.detectDir))
  ).map((descriptor) => descriptor.name);
}
