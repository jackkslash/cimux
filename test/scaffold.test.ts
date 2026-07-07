import { describe, expect, it } from "vitest";
import { getProjectStage, name, version } from "../src/index.js";
import packageJson from "../package.json" with { type: "json" };

describe("Project identity", () => {
  it("exports the package identity", () => {
    expect(name).toBe("cimux");
    expect(getProjectStage()).toBe("local-mvp");
  });

  it("keeps version.ts in sync with package.json", () => {
    expect(version).toBe(packageJson.version);
  });
});
