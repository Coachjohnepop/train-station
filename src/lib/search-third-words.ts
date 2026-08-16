/**
 * Third words after “The Train Station”.
 * Generic “train” / “station” / “fitness” alone will not rank.
 * “The Train Station fitness” (and the rest of this list) is the find-us pattern.
 */
export const SEARCH_THIRD_WORDS = [
  "fitness",
  "workout",
  "exercise",
  "coaching",
  "Jeremy",
  "Byrd",
  "weight loss",
  "program",
  "live class",
  "strength",
  "accountability",
  "app",
  "online training",
  "personal trainer",
  "Adult",
  "athletes",
  "military",
  "home workout",
  "Coach Class",
  "tickets",
] as const;

/** Misspellings people will actually type. */
export const SEARCH_THIRD_WORD_ALIASES = ["Bird"] as const;

export function trainStationSearchPhrases(): string[] {
  return [
    "The Train Station",
    "thetrainstation.co",
    ...SEARCH_THIRD_WORDS.map((word) => `The Train Station ${word}`),
    ...SEARCH_THIRD_WORD_ALIASES.map((word) => `The Train Station ${word}`),
  ];
}

export function searchKeywordsCsv(): string {
  return trainStationSearchPhrases().join(", ");
}
