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
import { calculateBurnRateTimeSeries } from '../lib/sloMath';

interface BurnRateChartProps {
  sli: SLI;
  dataPoints: DataPoint[];
  objectivePercent: number;
  darkMode?: boolean;
}

export function BurnRateChart({
  sli,
  dataPoints,
  objectivePercent,
  darkMode = false,
}: BurnRateChartProps) {
  // Calculate burn rate time series
  const chartData = useMemo(() => {
    const burnRateData = calculateBurnRateTimeSeries(dataPoints, sli, objectivePercent, 1);

    return burnRateData.map((point) => {
      const date = new Date(point.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      return {
        timestamp: date.getTime(),
        date: dateStr,
        fullDate: date.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit' 
        }),
        burnRate: point.burnRate,
        p50BurnRate: point.p50BurnRate,
        p90BurnRate: point.p90BurnRate,
        p95BurnRate: point.p95BurnRate,
        p99BurnRate: point.p99BurnRate,
      };
    });
  }, [dataPoints, sli, objectivePercent]);

  // Determine if we have percentile data
  const hasPercentiles = chartData.length > 0 && chartData[0].p50BurnRate !== undefined;

  // Calculate current burn rates for badges
  const currentBurnRates = useMemo(() => {
    if (chartData.length === 0) return null;
    const latest = chartData[chartData.length - 1];
    return {
      p50: latest.p50BurnRate,
      p90: latest.p90BurnRate,
      p95: latest.p95BurnRate,
      p99: latest.p99BurnRate,
      overall: latest.burnRate,
    };
  }, [chartData]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 6];

    const allValues = hasPercentiles
      ? chartData.flatMap((d) =>
          [d.p50BurnRate, d.p90BurnRate, d.p95BurnRate, d.p99BurnRate].filter(
            (v) => v !== undefined
          ) as number[]
        )
      : chartData.map((d) => d.burnRate);

    const max = Math.max(...allValues, 2); // At least show up to 2x
    return [0, Math.ceil(max * 1.2)]; // Add 20% padding
  }, [chartData, hasPercentiles]);

  const colors = {
    p50: '#3b82f6', // blue
    p90: '#10b981', // green
    p95: '#f59e0b', // amber
    p99: '#ef4444', // red
    excellent: darkMode ? '#6b7280' : '#9ca3af',
    good: darkMode ? '#6b7280' : '#9ca3af',
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
          {hasPercentiles ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p50 }}>● p50 burn</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p50BurnRate?.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p90 }}>● p90 burn</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p90BurnRate?.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p95 }}>● p95 burn</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p95BurnRate?.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p99 }}>● p99 burn</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p99BurnRate?.toFixed(2)}x
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600 dark:text-neutral-400">Burn Rate</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {data.burnRate?.toFixed(2)}x
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-neutral-200 dark:border-neutral-700 mt-2 pt-2 text-xs">
          <div className="text-neutral-500 dark:text-neutral-400">
            {data.burnRate < 1
              ? '✓ Excellent (under budget)'
              : data.burnRate < 2
              ? '⚠ Good (elevated)'
              : '✗ Critical (burning fast)'}
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
          Error Budget Burn Rate
        </h3>
        {hasPercentiles && currentBurnRates && (
          <div className="flex items-center gap-1.5">
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              p50: {currentBurnRates.p50?.toFixed(1)}x
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              p90: {currentBurnRates.p90?.toFixed(1)}x
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              p95: {currentBurnRates.p95?.toFixed(1)}x
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              p99: {currentBurnRates.p99?.toFixed(1)}x
            </div>
          </div>
        )}
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
            domain={yDomain}
            tickFormatter={(value) => `${Number(value).toFixed(1)}x`}
            label={{
              value: 'Burn Rate',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: colors.text },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Threshold lines */}
          <ReferenceLine
            y={1}
            stroke={colors.excellent}
            strokeDasharray="5 5"
            strokeWidth={1}
            label={{
              value: 'excellent: 1x',
              position: 'right',
              style: { fontSize: 10, fill: colors.excellent },
            }}
          />
          <ReferenceLine
            y={2}
            stroke={colors.good}
            strokeDasharray="3 3"
            strokeWidth={1}
            label={{
              value: 'good: 2x',
              position: 'right',
              style: { fontSize: 10, fill: colors.good },
            }}
          />

          {/* Burn rate lines */}
          {hasPercentiles ? (
            <>
              <Line
                type="monotone"
                dataKey="p50BurnRate"
                stroke={colors.p50}
                strokeWidth={2}
                dot={false}
                name="p50"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p90BurnRate"
                stroke={colors.p90}
                strokeWidth={2}
                dot={false}
                name="p90"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p95BurnRate"
                stroke={colors.p95}
                strokeWidth={2}
                dot={false}
                name="p95"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p99BurnRate"
                stroke={colors.p99}
                strokeWidth={2}
                dot={false}
                name="p99"
                connectNulls
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="burnRate"
              stroke={colors.p95}
              strokeWidth={2}
              dot={false}
              name="Burn Rate"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

