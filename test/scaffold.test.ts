import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getProjectStage, isCliEntrypoint, name, version } from "../src/index.js";
import packageJson from "../package.json" with { type: "json" };

describe("Project identity", () => {
  it("exports the package identity", () => {
    expect(name).toBe("cimux");
    expect(getProjectStage()).toBe("local-mvp");
  });

  it("keeps version.ts in sync with package.json", () => {
    expect(version).toBe(packageJson.version);
  });

  it("recognizes a symlinked npm bin entrypoint", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cimux-bin-"));
    try {
      const target = path.join(tempDir, "index.js");
      const link = path.join(tempDir, "cimux");
      fs.writeFileSync(target, "");
      fs.symlinkSync(target, link);

      expect(isCliEntrypoint(link, target)).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
