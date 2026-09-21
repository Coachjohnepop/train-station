import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendPaymentNote,
  BUSINESS_UPGRADE_REQUEST_COPY,
  MONTHLY_UPGRADE_PROMO_COPY,
  businessUpgradeQueueDetail,
  businessUpgradeQueueHeadline,
  canRequestBusinessClassUpgrade,
  isBusinessUpgradePending,
  isPayingCoachUpgradeEntrant,
  memberDisplayNameFromEmail,
  normalizeBusinessUpgradeStatus,
  ordinalPlace,
  pickMonthlyPromoWinner,
  placeInBusinessUpgradeQueue,
  sortBusinessUpgradeQueue,
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

  it("ranks the upgrade list first-come like a Delta waitlist", () => {
    assert.equal(ordinalPlace(1), "1st");
    assert.equal(ordinalPlace(2), "2nd");
    assert.equal(ordinalPlace(3), "3rd");
    assert.equal(ordinalPlace(4), "4th");
    assert.equal(ordinalPlace(11), "11th");
    assert.equal(ordinalPlace(21), "21st");
    const queue = sortBusinessUpgradeQueue([
      { userId: "c", requestedAt: "2026-09-21T12:00:00.000Z" },
      { userId: "a", requestedAt: "2026-09-21T11:00:00.000Z" },
      { userId: "b", requestedAt: "2026-09-21T11:00:00.000Z" },
    ]);
    assert.deepEqual(
      queue.map((row) => row.userId),
      ["a", "b", "c"],
    );
    const second = placeInBusinessUpgradeQueue(queue, "b");
    assert.equal(second?.position, 2);
    assert.equal(second?.ahead, 1);
    assert.equal(second?.size, 3);
    assert.equal(businessUpgradeQueueHeadline(second!), "You're 2nd on the upgrade list");
    assert.equal(businessUpgradeQueueDetail(second!), "1 request ahead of you · 3 on the list.");
    const first = placeInBusinessUpgradeQueue(queue, "a");
    assert.equal(
      businessUpgradeQueueDetail(first!),
      "No one ahead of you · 3 on the list.",
    );
  });

  it("enters paying Coach requests in the monthly drawing, not staff grants", () => {
    assert.match(MONTHLY_UPGRADE_PROMO_COPY, /one paying Coach Class member/i);
    assert.equal(
      isPayingCoachUpgradeEntrant({
        plan: "member",
        paymentStatus: "paid",
        paymentMethod: "stripe",
        businessUpgradeStatus: "pending",
      }),
      true,
    );
    assert.equal(
      isPayingCoachUpgradeEntrant({
        plan: "member",
        paymentStatus: "paid",
        paymentMethod: "venmo",
        businessUpgradeStatus: "pending",
      }),
      true,
    );
    assert.equal(
      isPayingCoachUpgradeEntrant({
        plan: "member",
        paymentStatus: "paid",
        paymentMethod: "manual",
        businessUpgradeStatus: "pending",
      }),
      false,
    );
    const pool = ["ali", "todd", "stephanie"];
    assert.equal(pickMonthlyPromoWinner(pool, () => 1), "todd");
    assert.equal(pickMonthlyPromoWinner([], () => 0), null);
  });
});
