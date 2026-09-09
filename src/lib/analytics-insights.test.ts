import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlaybook,
  emptyInsightInput,
  formatPct,
  type InsightInput,
} from "./analytics-insights";

function base(over: Partial<InsightInput> = {}): InsightInput {
  return {
    ...emptyInsightInput(1),
    views: 80,
    clicks: 180,
    sessions: 30,
    homepageViews: 30,
    joinViews: 11,
    signupViews: 4,
    mobileViews: 65,
    desktopViews: 13,
    facebookViews: 33,
    facebookClicks: 40,
    namedActions: {
      "hero-free-tour": 9,
      "hero-start-membership": 2,
      "hero-explore-content": 6,
      "tour-continue-free": 1,
    },
    namedTexts: { "Close tour": 3, "Play background music": 5 },
    musicTaps: 5,
    workoutFinishClicks: 20,
    ...over,
  };
}

describe("buildPlaybook", () => {
  it("flags Facebook traffic that never boards", () => {
    const book = buildPlaybook(base({ signups: 0 }));
    const ids = book.effective.map((i) => i.id);
    assert.ok(ids.includes("join-leak"));
    assert.ok(ids.includes("fb-no-board"));
    assert.equal(book.funnel.tourOpens, 9);
    assert.equal(book.funnel.tourCloses, 3);
    assert.ok(book.plan.some((p) => p.id === "ticket-one-tap"));
  });

  it("treats high tour-close as a better-pillar fix", () => {
    const book = buildPlaybook(
      base({
        namedActions: { "hero-free-tour": 10, "close-tour": 6, "hero-start-membership": 1 },
        namedTexts: {},
      }),
    );
    const bail = book.better.find((i) => i.id === "tour-bail");
    assert.ok(bail);
    assert.equal(bail?.tone, "fix");
  });

  it("keeps Theme Song as a fun win when people tap music", () => {
    const book = buildPlaybook(base());
    assert.ok(book.fun.some((i) => i.id === "theme-song"));
    assert.ok(book.plan[0]?.id === "phone-verify");
  });

  it("does not crash on an empty window", () => {
    const book = buildPlaybook(emptyInsightInput(7));
    assert.ok(book.better.length >= 1);
    assert.ok(book.plan.length >= 3);
    assert.equal(formatPct(0, 0), "—");
  });

  it("counts Get started as a membership tap", () => {
    const book = buildPlaybook(
      base({
        namedActions: { "tour-get-started": 4, "hero-start-membership": 1 },
        namedTexts: {},
      }),
    );
    assert.equal(book.funnel.startMembership, 5);
    assert.equal(book.funnel.tourGetStarted, 4);
  });
});
