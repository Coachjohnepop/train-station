export type ExerciseCatalogMatchPreview = {
  parsedName: string;
  section: string;
  status: "matched" | "new" | "note";
  catalogId: string | null;
  catalogName: string | null;
  nameDiffers: boolean;
  hasVideo: boolean;
};

export type WorkoutCatalogPreview = {
  rows: ExerciseCatalogMatchPreview[];
  summary: {
    total: number;
    matched: number;
    newCount: number;
    noteBlocks: number;
  };
};