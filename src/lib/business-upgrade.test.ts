import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendPaymentNote,
  BUSINESS_UPGRADE_REQUEST_COPY,
  canRequestBusinessClassUpgrade,
  isBusinessUpgradePending,
  memberDisplayNameFromEmail,
  normalizeBusinessUpgradeStatus,
} from "./business-upgrade";

describe("business class upgrade request", () => {
  it("uses the airline-style CTA copy", () => {
    assert.equal(
      BUSINESS_UPGRADE_REQUEST_COPY,
      "Like to join Live Zooms? Request Upgrade to Business Class",
    );
  });

  it("offers the request to anyone who finished Coach Class payment", () => {
    assert.equal(
      canRequestBusinessClassUpgrade({ plan: "member", paymentStatus: "paid" }),
      true,
    );
    assert.equal(
      canRequestBusinessClassUpgrade({
        plan: "member",
        paymentStatus: "paid",
        businessUpgradeStatus: "declined",
      }),
      true,
    );
  });

  it("hides the request until Coach payment is finalized", () => {
    assert.equal(
      canRequestBusinessClassUpgrade({ plan: "member", paymentStatus: "pending" }),
      false,
    );
    assert.equal(
      canRequestBusinessClassUpgrade({ plan: "explorer", paymentStatus: "paid" }),
      false,
    );
    assert.equal(
      canRequestBusinessClassUpgrade({ plan: "business", paymentStatus: "paid" }),
      false,
    );
  });

  it("does not let a pending or approved request fire again", () => {
    assert.equal(
      canRequestBusinessClassUpgrade({
        plan: "member",
        paymentStatus: "paid",
        businessUpgradeStatus: "pending",
      }),
      false,
    );
    assert.equal(
      canRequestBusinessClassUpgrade({
        plan: "member",
        paymentStatus: "paid",
        businessUpgradeStatus: "approved",
      }),
      false,
    );
    assert.equal(
      isBusinessUpgradePending({ plan: "member", businessUpgradeStatus: "pending" }),
      true,
    );
  });

  it("normalizes status and appends payment notes", () => {
    assert.equal(normalizeBusinessUpgradeStatus("PENDING"), "pending");
    assert.equal(normalizeBusinessUpgradeStatus("nope"), null);
    assert.equal(appendPaymentNote(null, "Upgrade requested"), "Upgrade requested");
    assert.equal(
      appendPaymentNote("Staff grant", "Upgrade requested"),
      "Staff grant\nUpgrade requested",
    );
    assert.equal(
      memberDisplayNameFromEmail("ali@example.com", "Ali Fletcher"),
      "Ali Fletcher",
    );
    assert.equal(memberDisplayNameFromEmail("ali@example.com"), "ali");
  });
});
