import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowThemeSong, isGuestThemeSongPath } from "./theme-song";

describe("theme song guest gate", () => {
  it("allows landing, join, login, and explore paths", () => {
    for (const path of ["/", "/join", "/join/questions", "/signup", "/login", "/free", "/find"]) {
      assert.equal(isGuestThemeSongPath(path), true);
      assert.equal(allowThemeSong(path, false), true);
    }
  });

  it("never plays after a login exists", () => {
    for (const path of ["/", "/join", "/member/today", "/member/workout", "/admin"]) {
      assert.equal(allowThemeSong(path, true), false);
    }
  });

  it("is off the member and coach apps even before auth resolves", () => {
    assert.equal(allowThemeSong("/member/today", false), false);
    assert.equal(allowThemeSong("/member/workout", false), false);
    assert.equal(allowThemeSong("/member/onboard", false), false);
    assert.equal(allowThemeSong("/member/checkout", false), false);
    assert.equal(allowThemeSong("/admin/today", false), false);
  });
});
