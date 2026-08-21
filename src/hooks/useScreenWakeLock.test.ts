import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { iosNeedsVideoKeepAwake } from "./useScreenWakeLock";

describe("iosNeedsVideoKeepAwake", () => {
  it("is true for iPhone and iPad", () => {
    assert.equal(
      iosNeedsVideoKeepAwake(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      true,
    );
    assert.equal(
      iosNeedsVideoKeepAwake(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
      true,
    );
  });

  it("is true for iPadOS desktop UA with touch", () => {
    assert.equal(
      iosNeedsVideoKeepAwake(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5,
      ),
      true,
    );
  });

  it("is false for Android and desktop Mac", () => {
    assert.equal(
      iosNeedsVideoKeepAwake(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0",
      ),
      false,
    );
    assert.equal(
      iosNeedsVideoKeepAwake(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        0,
      ),
      false,
    );
  });
});
