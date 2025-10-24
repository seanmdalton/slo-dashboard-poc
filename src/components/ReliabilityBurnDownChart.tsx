import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { SLI, DataPoint } from '../models/slo';
import { calculateErrorBudget } from '../lib/sloMath';

interface ReliabilityBurnDownChartProps {
  sli: SLI;
  dataPoints: DataPoint[];
  objectivePercent: number;
  darkMode?: boolean;
}

export function ReliabilityBurnDownChart({
  sli,
  dataPoints,
  objectivePercent,
  darkMode = false,
}: ReliabilityBurnDownChartProps) {
  // Calculate cumulative error budget remaining over time
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];

    let cumulativeGood = 0;
    let cumulativeBad = 0;
    let cumulativeLatencyMeetingTarget = 0;
    let cumulativeLatencyTotal = 0;

    return dataPoints.map((point) => {
      const date = new Date(point.t);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const fullDate = date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      });

      // Accumulate based on SLI type
      if (sli.type === 'latency') {
        cumulativeLatencyTotal++;
        const value = point.p95 ?? point.value ?? 0; // Use p95 if available, fallback to value
        if (sli.objectiveDirection === 'lte' ? value <= sli.target : value >= sli.target) {
          cumulativeLatencyMeetingTarget++;
        }
        const cumulativePerformance =
          cumulativeLatencyTotal > 0
            ? (cumulativeLatencyMeetingTarget / cumulativeLatencyTotal) * 100
            : 100;
        const errorBudget = calculateErrorBudget(cumulativePerformance, objectivePercent);

        return {
          timestamp: date.getTime(),
          date: dateStr,
          fullDate,
          errorBudgetRemaining: errorBudget.remainingPercent,
          performance: cumulativePerformance,
        };
      } else {
        // Availability-like metrics
        cumulativeGood += point.good;
        cumulativeBad += point.bad;
        const total = cumulativeGood + cumulativeBad;
        const cumulativePerformance = total > 0 ? (cumulativeGood / total) * 100 : 100;
        const errorBudget = calculateErrorBudget(cumulativePerformance, objectivePercent);

        return {
          timestamp: date.getTime(),
          date: dateStr,
          fullDate,
          errorBudgetRemaining: errorBudget.remainingPercent,
          performance: cumulativePerformance,
        };
      }
    });
  }, [dataPoints, sli, objectivePercent]);

  // Get current error budget status
  const currentBudget = useMemo(() => {
    if (chartData.length === 0) return 100;
    return chartData[chartData.length - 1].errorBudgetRemaining;
  }, [chartData]);

  // Determine line color based on budget remaining
  const lineColor = useMemo(() => {
    if (currentBudget >= 50) return '#10b981'; // green
    if (currentBudget >= 20) return '#f59e0b'; // amber
    return '#ef4444'; // red
  }, [currentBudget]);

  const colors = {
    line: lineColor,
    objective: darkMode ? '#6b7280' : '#9ca3af',
    grid: darkMode ? '#374151' : '#e5e7eb',
    text: darkMode ? '#9ca3af' : '#6b7280',
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 shadow-lg">
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">{data.fullDate}</div>
        <div className="text-xs space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-600 dark:text-neutral-400">Error Budget</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {data.errorBudgetRemaining.toFixed(1)}% remaining
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-600 dark:text-neutral-400">Performance</span>
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {data.performance.toFixed(3)}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Reliability Burn Down
        </h3>
        <div className="flex items-center gap-1.5">
          <div
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              currentBudget >= 50
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : currentBudget >= 20
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {currentBudget >= 50 ? 'good' : currentBudget >= 20 ? 'at risk' : 'breaching'}: {currentBudget.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.5} />
          <XAxis
            dataKey="date"
            stroke={colors.text}
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            stroke={colors.text}
            tick={{ fontSize: 11 }}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{
              value: 'Error Budget',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: colors.text },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reliability Objective line */}
          <ReferenceLine
            y={100}
            stroke={colors.objective}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{
              value: `Objective: ${objectivePercent}%`,
              position: 'right',
              style: { fontSize: 10, fill: colors.objective },
            }}
          />

          {/* Error budget line */}
          <Line
            type="monotone"
            dataKey="errorBudgetRemaining"
            stroke={colors.line}
            strokeWidth={2.5}
            dot={false}
            name="Error Budget"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

