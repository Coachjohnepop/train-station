import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultExploreCatalog,
  emptyExploreContent,
  normalizeExploreContent,
  resolveExploreCards,
  exploreCopyById,
  patchExploreContent,
} from "./explore-content";

describe("explore content", () => {
  it("catalogs live programs, waitlist tracks, and services", () => {
    const ids = defaultExploreCatalog().map((c) => c.id);
    assert.ok(ids.includes("adult"));
    assert.ok(ids.includes("stretching"));
    assert.ok(ids.includes("team_consultation"));
    const adult = defaultExploreCatalog().find((c) => c.id === "adult");
    assert.equal(adult?.name, "Adult Strength & Conditioning");
    assert.equal(adult?.subtitle, "On the platform");
  });

  it("keeps the program name as the card title unless overridden", () => {
    const cards = resolveExploreCards(emptyExploreContent());
    const adult = cards.find((c) => c.id === "adult");
    assert.equal(adult?.name, adult?.catalogName);
    assert.equal(adult?.name, "Adult Strength & Conditioning");
  });

  it("applies subtitle, description, image, and name overrides", () => {
    const cfg = normalizeExploreContent({
      cards: {
        adult: {
          name: "Adult Strength & Conditioning",
          subtitle: "Board this track",
          description: "Gym and home, every day.",
          imageUrl: "https://example.com/adult.jpg",
        },
      },
    });
    const adult = resolveExploreCards(cfg).find((c) => c.id === "adult");
    assert.equal(adult?.name, "Adult Strength & Conditioning");
    assert.equal(adult?.subtitle, "Board this track");
    assert.equal(adult?.description, "Gym and home, every day.");
    assert.equal(adult?.imageUrl, "https://example.com/adult.jpg");
    assert.equal(exploreCopyById(cfg).adult?.name, "Adult Strength & Conditioning");
  });

  it("drops junk image URLs and unknown slugs", () => {
    const cfg = normalizeExploreContent({
      cards: {
        adult: { imageUrl: "javascript:alert(1)", subtitle: "Live now" },
        "not-a-card": { name: "Nope" },
      },
    });
    assert.equal(cfg.cards["not-a-card"], undefined);
    const adult = resolveExploreCards(cfg).find((c) => c.id === "adult");
    assert.equal(adult?.subtitle, "Live now");
    assert.ok(adult?.imageUrl?.startsWith("/images/programs/"));
  });

  it("patches one card without wiping siblings", () => {
    const first = patchExploreContent(emptyExploreContent(), {
      stretching: { subtitle: "Soon on the platform", description: "Mobility every morning." },
    });
    const next = patchExploreContent(first, {
      adult: { imageUrl: "/images/programs/adult.jpg" },
    });
    assert.equal(next.cards.stretching?.subtitle, "Soon on the platform");
    assert.equal(next.cards.adult?.imageUrl, "/images/programs/adult.jpg");
  });
});
