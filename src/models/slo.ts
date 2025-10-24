export type SLIType = "availability" | "latency" | "quality" | "freshness" | "correctness";
export type TimeWindow = "7d" | "28d" | "90d";

export interface DataPoint {
  t: string; // ISO timestamp
  good: number; // for availability metrics
  bad: number; // for availability metrics
  value?: number; // legacy single value (deprecated for latency)
  // Percentile data for latency metrics
  p50?: number; // 50th percentile (median)
  p90?: number; // 90th percentile
  p95?: number; // 95th percentile
  p99?: number; // 99th percentile
}

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
