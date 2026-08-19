import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { attachFinisherNames, displayFinisherFirstName } from "./day-finishers-format";

describe("displayFinisherFirstName", () => {
  it("shortens Lemon John to John", () => {
    assert.equal(displayFinisherFirstName("Lemon John", "john@lemonvoice.com"), "John");
  });

  it("uses the first name", () => {
    assert.equal(displayFinisherFirstName("Stephanie Popham", "s@x.com"), "Stephanie");
    assert.equal(displayFinisherFirstName("Ali Fletcher", "a@x.com"), "Ali");
  });
});

describe("attachFinisherNames", () => {
  it("stamps names onto matching calendar days", () => {
    const days = attachFinisherNames(
      [
        { iso: "W1D1", calendarDate: "2026-08-18" },
        { iso: "W1D2", calendarDate: "2026-08-19" },
      ],
      {
        "2026-08-18": [
          { userId: "a", name: "Ali" },
          { userId: "j", name: "John" },
          { userId: "s", name: "Stephanie" },
        ],
      },
    );
    assert.deepEqual(days[0].finisherNames, ["Ali", "John", "Stephanie"]);
    assert.deepEqual(days[1].finisherNames, []);
  });
});
