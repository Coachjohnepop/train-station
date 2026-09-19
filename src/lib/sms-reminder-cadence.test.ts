import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSmsReminderCadence,
  wantsDailyProgramReminder,
} from "./sms-reminder-cadence";

describe("sms reminder cadence", () => {
  it("parses the two intro answers", () => {
    assert.equal(parseSmsReminderCadence("Consistent"), "consistent");
    assert.equal(parseSmsReminderCadence("minimum"), "minimum");
    assert.equal(parseSmsReminderCadence(""), null);
  });

  it("daily blast only for consistent (or legacy time with no answer)", () => {
    assert.equal(
      wantsDailyProgramReminder({ cadence: "consistent", dailyReminderTime: "07:30" }),
      true,
    );
    assert.equal(
      wantsDailyProgramReminder({ cadence: "minimum", dailyReminderTime: "07:30" }),
      false,
    );
    assert.equal(
      wantsDailyProgramReminder({ cadence: null, dailyReminderTime: "07:30" }),
      true,
    );
    assert.equal(
      wantsDailyProgramReminder({ cadence: "consistent", dailyReminderTime: null }),
      false,
    );
  });
});
