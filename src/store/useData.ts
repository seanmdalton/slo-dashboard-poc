import { create } from "zustand";
import seed from "../data/seed.json";
import series from "../data/series.json";
import type { ExperienceRollup } from "../models/slo";

type State = {
  seed: { experiences: ExperienceRollup[] };
  series: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
};

export const useData = create<State>(() => ({
  seed: seed as { experiences: ExperienceRollup[] },
  series: series as Record<string, { t: string; good: number; bad: number; value?: number }[]>
}));
