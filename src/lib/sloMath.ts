import type { SLI, SLO } from "../models/slo";

export type DataPoint = { t: string; good: number; bad: number; value?: number };

export function availabilityFromPoints(points: { good: number; bad: number }[]) {
  const g = points.reduce((a, p) => a + p.good, 0);
  const b = points.reduce((a, p) => a + p.bad, 0);
  const pct = g / (g + b || 1) * 100;
  return { pct, good: g, bad: b };
}

export function burnRate(pct: number, objective: number) {
  // error budget spent vs allowed over window
  const err = 100 - pct;
  const budget = 100 - objective;
  return budget > 0 ? err / budget : Infinity;
}

/**
 * Get the current value for an SLI from time series data
 */
export function getCurrentSLIValue(sli: SLI, dataPoints: DataPoint[]): number {
  if (!dataPoints || dataPoints.length === 0) return 0;

  if (sli.type === "availability" || sli.type === "quality" || sli.type === "freshness" || sli.type === "correctness") {
    // For availability-like metrics, compute from good/bad
    const result = availabilityFromPoints(dataPoints);
    return result.pct;
  } else if (sli.type === "latency") {
    // For latency, use the last value
    const last = dataPoints[dataPoints.length - 1];
    return last?.value ?? 0;
  }
  return 0;
}

/**
 * Check if an SLI meets its objective
 */
export function isSLIMeetingObjective(sli: SLI, currentValue: number): boolean {
  if (sli.objectiveDirection === "gte") {
    return currentValue >= sli.target;
  } else {
    return currentValue <= sli.target;
  }
}

/**
 * Check if an SLO is in compliance (all required SLIs meet their objectives)
 */
export function isSLOCompliant(slo: SLO, sliValues: Map<string, number>): boolean {
  for (const sli of slo.indicators) {
    const currentValue = sliValues.get(sli.id) ?? 0;
    if (!isSLIMeetingObjective(sli, currentValue)) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate error budget metrics
 */
export function calculateErrorBudget(achievedPercent: number, objectivePercent: number) {
  const errorBudgetPercent = 100 - objectivePercent;
  const errorPercent = 100 - achievedPercent;
  const spent = errorBudgetPercent > 0 ? errorPercent / errorBudgetPercent : 0;
  const remaining = Math.max(0, 1 - spent);
  
  return {
    errorBudgetPercent,
    spent: Math.min(1, spent), // cap at 1 (100%)
    remaining,
    spentPercent: Math.min(100, spent * 100),
    remainingPercent: remaining * 100
  };
}

/**
 * Slice data points for a time window ending now
 */
export function sliceTimeWindow(dataPoints: DataPoint[], windowMs: number): DataPoint[] {
  if (!dataPoints || dataPoints.length === 0) return [];
  
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  
  return dataPoints.filter(p => new Date(p.t) >= cutoff);
}

/**
 * Calculate burn rate for a specific time window
 */
export function calculateBurnRateForWindow(
  dataPoints: DataPoint[],
  windowMs: number,
  sli: SLI,
  objectivePercent: number
): number {
  const windowData = sliceTimeWindow(dataPoints, windowMs);
  if (windowData.length === 0) return 0;
  
  const currentValue = getCurrentSLIValue(sli, windowData);
  
  // For latency, convert to availability-like metric for burn rate calculation
  if (sli.type === "latency") {
    // Treat meeting latency target as "good"
    const meetsTarget = currentValue <= sli.target;
    const achieved = meetsTarget ? 99.9 : 95.0; // simplified for demo
    return burnRate(achieved, objectivePercent);
  }
  
  return burnRate(currentValue, objectivePercent);
}

/**
 * Calculate burn rates for multiple windows (1h, 6h, 24h, 3d)
 */
export function calculateBurnRates(
  dataPoints: DataPoint[],
  sli: SLI,
  objectivePercent: number
) {
  const windows = {
    "1h": 1 * 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000
  };
  
  return {
    "1h": calculateBurnRateForWindow(dataPoints, windows["1h"], sli, objectivePercent),
    "6h": calculateBurnRateForWindow(dataPoints, windows["6h"], sli, objectivePercent),
    "24h": calculateBurnRateForWindow(dataPoints, windows["24h"], sli, objectivePercent),
    "3d": calculateBurnRateForWindow(dataPoints, windows["3d"], sli, objectivePercent)
  };
}

/**
 * Get status based on burn rate
 */
export function getBurnRateStatus(burnRate: number): "ok" | "warn" | "critical" {
  if (burnRate < 1) return "ok";
  if (burnRate < 2) return "warn";
  return "critical";
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: "ok" | "warn" | "critical"): string {
  if (status === "ok") return "Within budget";
  if (status === "warn") return "At risk";
  return "Breaching";
}

/**
 * Detect incidents based on thresholds
 */
export function detectIncidents(dataPoints: DataPoint[], sli: SLI): Array<{timestamp: string, reason: string}> {
  const incidents: Array<{timestamp: string, reason: string}> = [];
  
  for (const point of dataPoints) {
    if (sli.type === "availability" || sli.type === "quality" || sli.type === "freshness") {
      const pct = availabilityFromPoints([point]).pct;
      if (pct < sli.target - 0.3) {
        incidents.push({
          timestamp: point.t,
          reason: `${sli.type} dropped to ${pct.toFixed(2)}% (target: ${sli.target}%)`
        });
      }
    } else if (sli.type === "latency") {
      const value = point.value ?? 0;
      if (value > sli.target * 1.25) {
        incidents.push({
          timestamp: point.t,
          reason: `Latency spiked to ${value.toFixed(0)}${sli.unit} (target: ${sli.target}${sli.unit})`
        });
      }
    }
  }
  
  return incidents;
}

/**
 * Aggregate data points by hour for heatmap
 */
export function aggregateByHour(dataPoints: DataPoint[], sli: SLI): Array<{hour: number, day: number, value: number}> {
  const hourlyData: Array<{hour: number, day: number, value: number}> = [];
  
  // Group by day and hour
  const grouped = new Map<string, DataPoint[]>();
  
  for (const point of dataPoints) {
    const date = new Date(point.t);
    const day = date.getDate();
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(point);
  }
  
  // Calculate value for each hour
  for (const [key, points] of grouped) {
    const [day, hour] = key.split('-').map(Number);
    const value = getCurrentSLIValue(sli, points);
    hourlyData.push({ hour, day, value });
  }
  
  return hourlyData;
}
