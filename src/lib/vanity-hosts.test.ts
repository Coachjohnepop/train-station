import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalSiteUrl,
  isVanityRedirectHost,
  requestHost,
} from "./vanity-hosts";

describe("vanity redirect hosts", () => {
  it("strips ports", () => {
    assert.equal(requestHost("www.allaboard.fit:443"), "www.allaboard.fit");
  });

  it("matches apex and www allaboard.fit", () => {
    assert.equal(isVanityRedirectHost("allaboard.fit"), true);
    assert.equal(isVanityRedirectHost("WWW.AllAboard.fit"), true);
    assert.equal(isVanityRedirectHost("www.thetrainstation.co"), false);
    assert.equal(isVanityRedirectHost("localhost:3000"), false);
  });

  it("builds the canonical URL", () => {
    assert.equal(canonicalSiteUrl("/"), "https://www.thetrainstation.co/l/class");
    assert.equal(
      canonicalSiteUrl("/", "?utm=ig"),
      "https://www.thetrainstation.co/l/class?utm=ig",
    );
    assert.equal(
      canonicalSiteUrl("/join", "?plan=member"),
      "https://www.thetrainstation.co/join?plan=member",
    );
  });
});
