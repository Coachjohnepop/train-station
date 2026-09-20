import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLoopUserAgent,
  LEGACY_LOOP_IPHONE_UA,
  LOOP_UA_TOKEN,
  withLoopUserAgent,
} from "./loop-traffic";

describe("isLoopUserAgent", () => {
  it("flags the loop token, Playwright, and HeadlessChrome", () => {
    assert.equal(isLoopUserAgent(`Safari ${LOOP_UA_TOKEN}/1`), true);
    assert.equal(isLoopUserAgent("Mozilla/5.0 Playwright/1.0"), true);
    assert.equal(isLoopUserAgent("Mozilla/5.0 HeadlessChrome/120"), true);
  });

  it("flags the old landing-ab-loop iPhone UA", () => {
    assert.equal(isLoopUserAgent(LEGACY_LOOP_IPHONE_UA), true);
  });

  it("lets a normal phone through", () => {
    assert.equal(
      isLoopUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
      false,
    );
    assert.equal(isLoopUserAgent(""), false);
    assert.equal(isLoopUserAgent(null), false);
  });
});

describe("withLoopUserAgent", () => {
  it("appends the token once", () => {
    const once = withLoopUserAgent("Safari");
    assert.match(once, new RegExp(LOOP_UA_TOKEN));
    assert.equal(withLoopUserAgent(once), once);
  });
});
