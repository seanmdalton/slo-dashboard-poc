import type { SLI, SLO, DataPoint } from "../models/slo";

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
    // For latency, return average latency across all data points
    const sum = dataPoints.reduce((acc, p) => acc + (p.value ?? 0), 0);
    return sum / dataPoints.length;
  }
  return 0;
}

/**
 * Calculate what percentage of time the latency SLI met its target
 * This is used for error budget calculations
 */
export function getLatencyCompliancePercent(sli: SLI, dataPoints: DataPoint[]): number {
  if (!dataPoints || dataPoints.length === 0) return 100;
  
  const meetingTarget = dataPoints.filter(p => {
    const value = p.value ?? 0;
    return sli.objectiveDirection === "lte" ? value <= sli.target : value >= sli.target;
  }).length;
  
  return (meetingTarget / dataPoints.length) * 100;
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
 * Slice data points for a time window ending at the fixed demo data boundary
 * Demo data represents Sept 26 - Oct 24, 2025 (fixed, will not age)
 * Charts display through Oct 23 to avoid showing partial Oct 24 data
 */
export function sliceTimeWindow(dataPoints: DataPoint[], windowMs: number): DataPoint[] {
  if (!dataPoints || dataPoints.length === 0) return [];
  
  // Use fixed end date for demo data visualization (Oct 23, 2025 23:59:59 UTC)
  const demoEndDate = new Date('2025-10-23T23:59:59Z');
  const cutoff = new Date(demoEndDate.getTime() - windowMs);
  
  return dataPoints.filter(p => new Date(p.t) >= cutoff && new Date(p.t) <= demoEndDate);
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
  
  // For latency, use compliance percentage (% of time meeting target)
  if (sli.type === "latency") {
    const compliancePercent = getLatencyCompliancePercent(sli, windowData);
    return burnRate(compliancePercent, objectivePercent);
  }
  
  // For availability-like metrics, use the success rate
  const currentValue = getCurrentSLIValue(sli, windowData);
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

/**
 * NEW: Calculate burn rate time series for historical chart
 * Returns burn rate for each time point based on a sliding window
 */
export interface BurnRatePoint {
  timestamp: string;
  burnRate: number;
  p50BurnRate?: number;
  p90BurnRate?: number;
  p95BurnRate?: number;
  p99BurnRate?: number;
}

export function calculateBurnRateTimeSeries(
  dataPoints: DataPoint[],
  sli: SLI,
  objectivePercent: number,
  windowHours: number = 1
): BurnRatePoint[] {
  if (!dataPoints || dataPoints.length === 0) return [];
  
  const windowMs = windowHours * 60 * 60 * 1000;
  const burnRatePoints: BurnRatePoint[] = [];
  
  // For latency SLIs with percentiles, calculate burn rate for each percentile
  if (sli.type === "latency" && dataPoints[0].p50 !== undefined) {
    for (let i = 0; i < dataPoints.length; i++) {
      const currentTime = new Date(dataPoints[i].t);
      const windowStart = new Date(currentTime.getTime() - windowMs);
      
      // Get data points in the lookback window
      const windowData = dataPoints.filter(p => {
        const t = new Date(p.t);
        return t >= windowStart && t <= currentTime;
      });
      
      if (windowData.length === 0) continue;
      
      // Calculate compliance for each percentile
      const p50Compliance = windowData.filter(p => (p.p50 ?? 0) <= sli.target).length / windowData.length * 100;
      const p90Compliance = windowData.filter(p => (p.p90 ?? 0) <= sli.target).length / windowData.length * 100;
      const p95Compliance = windowData.filter(p => (p.p95 ?? 0) <= sli.target).length / windowData.length * 100;
      const p99Compliance = windowData.filter(p => (p.p99 ?? 0) <= sli.target).length / windowData.length * 100;
      
      burnRatePoints.push({
        timestamp: dataPoints[i].t,
        burnRate: burnRate(p95Compliance, objectivePercent), // Use p95 as primary
        p50BurnRate: burnRate(p50Compliance, objectivePercent),
        p90BurnRate: burnRate(p90Compliance, objectivePercent),
        p95BurnRate: burnRate(p95Compliance, objectivePercent),
        p99BurnRate: burnRate(p99Compliance, objectivePercent)
      });
    }
  } else {
    // For availability metrics, single burn rate
    for (let i = 0; i < dataPoints.length; i++) {
      const currentTime = new Date(dataPoints[i].t);
      const windowStart = new Date(currentTime.getTime() - windowMs);
      
      const windowData = dataPoints.filter(p => {
        const t = new Date(p.t);
        return t >= windowStart && t <= currentTime;
      });
      
      if (windowData.length === 0) continue;
      
      const currentValue = getCurrentSLIValue(sli, windowData);
      
      burnRatePoints.push({
        timestamp: dataPoints[i].t,
        burnRate: burnRate(currentValue, objectivePercent)
      });
    }
  }
  
  return burnRatePoints;
}

/**
 * NEW: Detect breach periods where SLI exceeds threshold
 * Returns array of time ranges where metric was breaching
 */
export interface BreachPeriod {
  start: string;
  end: string;
  percentile?: 'p50' | 'p90' | 'p95' | 'p99';
}

export function detectBreachPeriods(
  dataPoints: DataPoint[],
  sli: SLI
): BreachPeriod[] {
  if (!dataPoints || dataPoints.length === 0) return [];
  
  const breaches: BreachPeriod[] = [];
  let currentBreach: { start: string; percentile?: string } | null = null;
  
  for (let i = 0; i < dataPoints.length; i++) {
    const point = dataPoints[i];
    let isBreaching = false;
    let breachPercentile: 'p50' | 'p90' | 'p95' | 'p99' | undefined;
    
    if (sli.type === "latency") {
      // Check each percentile for breach
      if (point.p99 && point.p99 > sli.target) {
        isBreaching = true;
        breachPercentile = 'p99';
      } else if (point.p95 && point.p95 > sli.target) {
        isBreaching = true;
        breachPercentile = 'p95';
      } else if (point.p90 && point.p90 > sli.target) {
        isBreaching = true;
        breachPercentile = 'p90';
      } else if (point.p50 && point.p50 > sli.target) {
        isBreaching = true;
        breachPercentile = 'p50';
      }
    } else if (sli.type === "availability" || sli.type === "quality") {
      const pct = availabilityFromPoints([point]).pct;
      isBreaching = pct < sli.target;
    }
    
    if (isBreaching) {
      if (!currentBreach) {
        currentBreach = { start: point.t, percentile: breachPercentile };
      }
    } else {
      if (currentBreach) {
        breaches.push({
          start: currentBreach.start,
          end: dataPoints[i - 1]?.t || point.t,
          percentile: currentBreach.percentile as any
        });
        currentBreach = null;
      }
    }
  }
  
  // Close any open breach at the end
  if (currentBreach) {
    breaches.push({
      start: currentBreach.start,
      end: dataPoints[dataPoints.length - 1].t,
      percentile: currentBreach.percentile as any
    });
  }
  
  return breaches;
}

/**
 * NEW: Get percentile value from a data point
 * Helper for chart rendering
 */
export function getPercentileValue(
  point: DataPoint,
  percentile: 'p50' | 'p90' | 'p95' | 'p99'
): number | undefined {
  return point[percentile];
}
