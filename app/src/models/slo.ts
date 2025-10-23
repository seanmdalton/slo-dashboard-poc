export type SLIType = "availability" | "latency" | "quality" | "freshness" | "correctness";
export type TimeWindow = "7d" | "28d" | "90d";

export interface SLI {
  id: string;
  name: string;
  type: SLIType;
  unit: "percent" | "ms" | "count";
  objectiveDirection: "gte" | "lte"; // gte for % good, lte for latency
  target: number; // e.g., 99.9 or 300 (ms)
  source: "synthetic" | "rum" | "server" | "queue" | "db";
}

export interface SLO {
  id: string;
  name: string; // e.g., "Checkout Availability"
  description: string;
  criticality: "tier-0" | "tier-1" | "tier-2";
  owner: string; // team
  budgetingWindowDays: 28;
  objectivePercent: number; // 99.9
  errorBudgetPercent: number; // 0.1
  indicators: SLI[];
}

export interface Journey {
  id: string;
  name: string; // e.g., "E-commerce Checkout"
  experience: "E-commerce" | "In-store" | "BOPIS" | "Returns";
  slos: SLO[];
}

export interface ExperienceRollup {
  name: string; // "E-commerce", "In-store"
  journeys: Journey[];
}
