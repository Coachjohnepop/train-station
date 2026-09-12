import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderedIdsFromGrid, placeItemsInSlotGrid } from "./program-calendar";

describe("placeItemsInSlotGrid", () => {
  it("keeps Cool Down in the last right-column slot after a middle delete", () => {
    const items = [
      { id: "w", sortOrder: 0, name: "Warm Up" },
      { id: "a", sortOrder: 1, name: "Taps" },
      { id: "b", sortOrder: 2, name: "Bench" },
      { id: "c", sortOrder: 4, name: "Row" },
      { id: "d", sortOrder: 5, name: "Raise" },
      { id: "e", sortOrder: 6, name: "Lateral" },
      { id: "f", sortOrder: 7, name: "Curls" },
      { id: "cd", sortOrder: 8, name: "Cool Down & Stretch" },
    ];
    const { grid } = placeItemsInSlotGrid(items);
    assert.equal(grid[3], null);
    assert.equal(grid[8]?.id, "cd");
    assert.notEqual(grid[5]?.id, "cd");
  });

  it("puts an add-below on the right into slot 9, not slot 1", () => {
    const items = [
      { id: "w", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
      { id: "d", sortOrder: 4 },
      { id: "e", sortOrder: 5 },
      { id: "f", sortOrder: 6 },
      { id: "g", sortOrder: 7 },
      { id: "h", sortOrder: 8 },
      { id: "cd", sortOrder: 9 },
    ];
    const { grid, counts } = placeItemsInSlotGrid(items);
    assert.deepEqual(counts, [5, 5]);
    assert.equal(grid[1]?.id, "a");
    assert.equal(grid[9]?.id, "cd");
  });
});

describe("orderedIdsFromGrid", () => {
  it("fills the empty right-column slot instead of appending then pinning", () => {
    const grid = [
      { id: "w" },
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
      { id: "e" },
      { id: "f" },
      { id: "g" },
      { id: "h" },
      null,
    ];
    assert.deepEqual(orderedIdsFromGrid(grid, 9, "cd"), [
      "w",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "cd",
    ]);
  });
});
