import { describe, expect, it } from "vitest";
import { getProjectStage, name } from "../src/index.js";

describe("Project identity", () => {
  it("exports the package identity", () => {
    expect(name).toBe("cimux");
    expect(getProjectStage()).toBe("local-mvp");
  });
});
