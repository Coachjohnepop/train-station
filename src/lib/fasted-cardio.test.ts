import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_FASTED_CARDIO_MINUTES,
  fastedCardioMinutesFromText,
  isFastedCardioBlock,
} from "./fasted-cardio";

describe("fasted cardio", () => {
  it("is one timed block, not 3 sets", () => {
    assert.equal(isFastedCardioBlock({ name: "Fasted Cardio" }), true);
    assert.equal(fastedCardioMinutesFromText("35 min fasted cardio"), 35);
    assert.equal(DEFAULT_FASTED_CARDIO_MINUTES, 35);
  });
});
