import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrollmentStartIsoForEmail, isStartOnDayTwoEmail } from "./member-start-exceptions";

describe("enrollmentStartIsoForEmail", () => {
  it("shifts only Todd so today is Day 2", () => {
    assert.equal(isStartOnDayTwoEmail("dubl-e@howerfamily.com"), true);
    assert.equal(enrollmentStartIsoForEmail("dubl-e@howerfamily.com", "2026-08-20"), "2026-08-19");
    assert.equal(
      enrollmentStartIsoForEmail("dubl-e@howerfamily.com", "2026-08-20", "2026-08-20"),
      "2026-08-19",
    );
  });

  it("leaves everyone else on the explicit or signup day", () => {
    assert.equal(enrollmentStartIsoForEmail("ali@example.com", "2026-08-20"), "2026-08-20");
    assert.equal(
      enrollmentStartIsoForEmail("ali@example.com", "2026-08-20", "2026-08-24"),
      "2026-08-24",
    );
  });
});
