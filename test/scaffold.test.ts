import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getProjectStage, isCliEntrypoint, name } from "../src/index.js";

describe("Project identity", () => {
  it("exports the package identity", () => {
    expect(name).toBe("cimux");
    expect(getProjectStage()).toBe("local-mvp");
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
