import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FREE_TICKET_FULL_SRC,
  FREE_TICKET_GAG_SRC,
  isRickrollVideoUrl,
  JEREMY_WELCOME_VIDEO_SRC,
  meetJeremyClipSrc,
} from "./landing-media";

describe("meet Jeremy clip is never the Free gag", () => {
  it("treats chorus and full Free files as rickroll", () => {
    assert.equal(isRickrollVideoUrl(FREE_TICKET_GAG_SRC), true);
    assert.equal(isRickrollVideoUrl(FREE_TICKET_FULL_SRC), true);
    assert.equal(isRickrollVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
    assert.equal(isRickrollVideoUrl(JEREMY_WELCOME_VIDEO_SRC), false);
  });

  it("falls back to the overall welcome, not the gag", () => {
    assert.equal(meetJeremyClipSrc(FREE_TICKET_FULL_SRC, null), JEREMY_WELCOME_VIDEO_SRC);
    assert.equal(
      meetJeremyClipSrc(FREE_TICKET_FULL_SRC, JEREMY_WELCOME_VIDEO_SRC),
      JEREMY_WELCOME_VIDEO_SRC,
    );
    assert.equal(meetJeremyClipSrc(null, null), JEREMY_WELCOME_VIDEO_SRC);
  });
});
