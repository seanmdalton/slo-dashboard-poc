import { useMemo } from "react";
import type { DataPoint } from "../models/slo";
import { aggregateByHour } from "../lib/sloMath";
import type { SLI } from "../models/slo";

interface ErrorBudgetHeatmapProps {
  data: DataPoint[];
  sli: SLI;
}

export default function ErrorBudgetHeatmap({ data, sli }: ErrorBudgetHeatmapProps) {
  const heatmapData = useMemo(() => aggregateByHour(data, sli), [data, sli]);

  // Get unique days and hours
  const days = useMemo(() => {
    const uniqueDays = [...new Set(heatmapData.map(d => d.day))].sort((a, b) => a - b);
    return uniqueDays.slice(-7); // Last 7 days
  }, [heatmapData]);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Create a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    heatmapData.forEach(d => {
      map.set(`${d.day}-${d.hour}`, d.value);
    });
    return map;
  }, [heatmapData]);

  // Get color for cell based on value
  const getColor = (value: number | undefined): string => {
    if (value === undefined) return "bg-neutral-100 dark:bg-neutral-800";
    
    const meetsTarget = sli.objectiveDirection === "gte"
      ? value >= sli.target
      : value <= sli.target;

    if (meetsTarget) {
      return "bg-green-100 dark:bg-green-900/40";
    } else if (sli.objectiveDirection === "gte" ? value >= sli.target - 0.5 : value <= sli.target * 1.1) {
      return "bg-amber-100 dark:bg-amber-900/40";
    } else {
      return "bg-red-200 dark:bg-red-900/50";
    }
  };

  return (
    <div className="w-full">
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">Error Budget by Hour (Last 7 Days)</div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex mb-1">
            <div className="w-12 flex-shrink-0" /> {/* Day label spacer */}
            {hours.map(hour => (
              <div
                key={hour}
                className="text-xs text-neutral-500 dark:text-neutral-400 text-center flex-shrink-0"
                style={{ width: '24px' }}
              >
                {hour % 6 === 0 ? hour : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          {days.map(day => (
            <div key={day} className="flex items-center mb-1">
              <div className="w-12 text-xs text-neutral-600 dark:text-neutral-400 flex-shrink-0">Day {day}</div>
              {hours.map(hour => {
                const value = dataMap.get(`${day}-${hour}`);
                return (
                  <div
                    key={hour}
                    className={`flex-shrink-0 h-5 border border-white dark:border-neutral-900 ${getColor(value)}`}
                    style={{ width: '24px' }}
                    title={value !== undefined ? `${value.toFixed(2)}` : 'No data'}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900/40 border border-white dark:border-neutral-900" />
          <span>Meeting target</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/40 border border-white dark:border-neutral-900" />
          <span>At risk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-200 dark:bg-red-900/50 border border-white dark:border-neutral-900" />
          <span>Breaching</span>
        </div>
      </div>
    </div>
  );
}
