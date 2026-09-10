import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeHowItWorks, defaultHowItWorks } from "./how-it-works";

describe("normalizeHowItWorks", () => {
  it("fills five default screens", () => {
    const cfg = normalizeHowItWorks(null);
    assert.equal(cfg.steps.length, 5);
    assert.deepEqual(
      cfg.steps.map((s) => s.id),
      ["workout", "ticket", "program", "gear", "book"],
    );
  });

  it("keeps admin copy and a trimmed voice URL", () => {
    const cfg = normalizeHowItWorks({
      steps: [
        {
          id: "workout",
          title: "Check a set",
          coachLine: "Tap the set when you finish.",
          voice: {
            audioUrl: "/audio/how-it-works-workout.mp3",
            startSec: 1.2,
            endSec: 8,
          },
        },
      ],
    });
    const workout = cfg.steps[0];
    assert.equal(workout.title, "Check a set");
    assert.equal(workout.voice.audioUrl, "/audio/how-it-works-workout.mp3");
    assert.equal(workout.voice.startSec, 1.2);
    assert.equal(workout.voice.endSec, 8);
    assert.equal(cfg.steps[1].id, "ticket");
  });

  it("drops junk URLs", () => {
    const cfg = normalizeHowItWorks({
      steps: [{ id: "ticket", voice: { audioUrl: "javascript:alert(1)" } }],
    });
    assert.equal(cfg.steps[1].voice.audioUrl, null);
    assert.equal(defaultHowItWorks().steps.length, 5);
  });
});
