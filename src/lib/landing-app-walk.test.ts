import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APP_WALK_COPY, APP_WALK_ORDER, WALK_VOICE_SRC } from "./landing-app-walk";

describe("landing app walk", () => {
  it("asks first, then walks real Today, not tickets", () => {
    assert.deepEqual(APP_WALK_ORDER, ["ask", "today", "set", "rest", "done"]);
    assert.ok(APP_WALK_COPY.today.line.toLowerCase().includes("today"));
    assert.ok(!Object.values(APP_WALK_COPY).some((c) => /ticket|1st class/i.test(c.line)));
    assert.equal(WALK_VOICE_SRC.today, "/audio/walk-today.mp3");
  });
});
