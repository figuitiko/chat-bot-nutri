import { describe, it, expect } from "vitest";
import { buildReorderUpdates } from "./course-reorder";

describe("buildReorderUpdates", () => {
  it("assigns 1-based sortOrder matching array position", () => {
    const result = buildReorderUpdates(["c", "a", "b"]);
    expect(result).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
      { id: "b", sortOrder: 3 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(buildReorderUpdates([])).toEqual([]);
  });

  it("handles single item", () => {
    expect(buildReorderUpdates(["x"])).toEqual([{ id: "x", sortOrder: 1 }]);
  });
});
