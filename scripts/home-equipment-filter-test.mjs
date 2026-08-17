#!/usr/bin/env node
/**
 * Home-kit checklist must stay the original 9 names + custom add-ons.
 * Shop/Amazon titles never appear as checkboxes.
 */
import {
  ORIGINAL_HOME_EQUIPMENT,
  homeEquipmentFromCatalog,
  isShopListingCopy,
} from "../src/lib/home-equipment-defaults.ts";

const catalog = [
  ...ORIGINAL_HOME_EQUIPMENT.map((item) => ({
    ...item,
    description: "Amazon.com : NICEPEOPLE Adjustable Weight Bench",
    productUrl: null,
    imageUrl: null,
  })),
  {
    id: "shop-1",
    name: "Amazon.com : HulkFit 10 LBS Pair Rubber Coated Hex Dumbbells",
    category: "dumbbells",
    description: "Sports & Outdoors",
    productUrl: "https://amazon.com/dp/x",
    imageUrl: null,
  },
  {
    id: "shop-2",
    name: "Amazon.com : Power Systems Versa Tube Plus",
    category: "bands",
    description: null,
    productUrl: null,
    imageUrl: null,
  },
  {
    id: "custom-1",
    name: "TRX straps",
    category: "custom",
    description: null,
    productUrl: null,
    imageUrl: null,
  },
  {
    id: "custom-amazon",
    name: "Amazon.com : fake custom",
    category: "custom",
    description: null,
    productUrl: null,
    imageUrl: null,
  },
];

const result = homeEquipmentFromCatalog(catalog);
const names = result.map((item) => item.name);
const expected = [...ORIGINAL_HOME_EQUIPMENT.map((item) => item.name), "TRX straps"].sort((a, b) => {
  if (a === "Bodyweight only") return -1;
  if (b === "Bodyweight only") return 1;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
});

let failed = 0;
function assert(ok, msg) {
  if (ok) console.log(`ok  ${msg}`);
  else {
    failed += 1;
    console.error(`FAIL ${msg}`);
  }
}

assert(names.length === expected.length, `count ${names.length} === ${expected.length}`);
assert(names.join("|") === expected.join("|"), `names\n  got: ${names.join(", ")}\n  exp: ${expected.join(", ")}`);
assert(result.every((item) => !item.description), "no shop descriptions leaked onto seed items");
assert(isShopListingCopy("Amazon.com : NICEPEOPLE bench"), "detects Amazon title");
assert(!isShopListingCopy("Dumbbells (pair)"), "keeps kit names");

if (failed) {
  process.exit(1);
}
console.log("home-equipment-filter-test passed");
