import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSwapNote,
  matchApprovedGrocery,
  normalizeGroceryLabel,
  offListNote,
  parseGroceryPaste,
} from "./approved-grocery-match";
import { APPROVED_GROCERY_SEED } from "./approved-grocery-seed";

const catalog = APPROVED_GROCERY_SEED.map((row, i) => ({
  id: `f${i}`,
  name: row.name,
  aliases: row.aliases,
  whyGood: row.whyGood,
  whyAvoid: row.whyAvoid,
}));

describe("grocery match", () => {
  it("strips quantities for matching", () => {
    assert.equal(normalizeGroceryLabel("2 lbs chicken breasts"), "chicken breasts");
  });

  it("parses paste into unique items", () => {
    assert.deepEqual(parseGroceryPaste("bacon\n2 lbs 80/20\nchicken breast, bacon"), [
      "bacon",
      "2 lbs 80/20",
      "chicken breast",
    ]);
  });

  it("maps chicken thighs-style aliases to chicken breast when labeled breasts", () => {
    const hit = matchApprovedGrocery("boneless skinless chicken breast", catalog);
    assert.equal(hit?.food.name, "Chicken breast");
  });

  it("maps 80/20-style turkey labels to lean turkey", () => {
    const hit = matchApprovedGrocery("93/7 ground turkey", catalog);
    assert.equal(hit?.food.name, "93% lean ground turkey");
  });

  it("does not treat bacon as an approved food", () => {
    const hit = matchApprovedGrocery("thick cut bacon", catalog);
    assert.equal(hit, null);
    assert.match(offListNote("bacon"), /Bacon/);
  });

  it("swaps 80/20 and buns from the table", () => {
    assert.equal(matchApprovedGrocery("80/20 beef", catalog)?.food.name, "93% lean ground turkey");
    assert.equal(matchApprovedGrocery("hamburger buns", catalog)?.food.name, "Lettuce");
    assert.equal(matchApprovedGrocery("chicken thighs", catalog)?.food.name, "Chicken breast");
  });

  it("maps cauliflower rice", () => {
    const hit = matchApprovedGrocery("frozen cauliflower rice", catalog);
    assert.equal(hit?.food.name, "Cauliflower");
  });

  it("builds a swap note with why good and why avoid", () => {
    const food = catalog.find((f) => f.name === "Lettuce")!;
    const note = formatSwapNote(food, "hamburger buns");
    assert.match(note, /hamburger buns → Lettuce/);
    assert.match(note, /bun/);
  });
});
