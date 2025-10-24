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
  ReferenceArea,
} from 'recharts';
import type { SLI, DataPoint } from '../models/slo';
import { detectBreachPeriods } from '../lib/sloMath';

interface SLIChartProps {
  sli: SLI;
  dataPoints: DataPoint[];
  darkMode?: boolean;
}

export function SLIChart({ sli, dataPoints, darkMode = false }: SLIChartProps) {
  // Determine if this is a latency SLI with percentiles
  const hasPercentiles = dataPoints.length > 0 && dataPoints[0].p50 !== undefined;

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return [];

    return dataPoints.map(point => {
      const date = new Date(point.t);
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
        p50: point.p50,
        p90: point.p90,
        p95: point.p95,
        p99: point.p99,
        value: point.value, // For availability metrics
        good: point.good,
        bad: point.bad,
      };
    });
  }, [dataPoints]);

  // Calculate current values for badges
  const currentValues = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return null;
    const latest = dataPoints[dataPoints.length - 1];
    return {
      p50: latest.p50,
      p90: latest.p90,
      p95: latest.p95,
      p99: latest.p99,
      value: latest.value,
    };
  }, [dataPoints]);

  // Detect breach periods for pink shading
  const breaches = useMemo(() => {
    return detectBreachPeriods(dataPoints, sli);
  }, [dataPoints, sli]);

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    if (hasPercentiles) {
      const allValues = chartData.flatMap(d => [d.p50, d.p90, d.p95, d.p99].filter(v => v !== undefined) as number[]);
      const min = Math.min(...allValues, sli.target);
      const max = Math.max(...allValues, sli.target);
      const padding = (max - min) * 0.1;
      return [Math.max(0, min - padding), max + padding];
    } else {
      // For availability metrics
      const allValues = chartData.map(d => {
        const total = d.good + d.bad;
        return total > 0 ? (d.good / total) * 100 : 100;
      });
      const min = Math.min(...allValues, sli.target);
      const max = Math.max(...allValues, sli.target);
      return [Math.max(0, min - 5), Math.min(100, max + 5)];
    }
  }, [chartData, hasPercentiles, sli.target]);

  const colors = {
    p50: '#3b82f6',   // blue
    p90: '#10b981',   // green
    p95: '#f59e0b',   // amber
    p99: '#ef4444',   // red
    target: darkMode ? '#6b7280' : '#9ca3af',
    breach: darkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
  };

  // Format tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 shadow-lg">
        <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
          {data.fullDate}
        </div>
        {hasPercentiles ? (
          <>
            <div className="text-xs space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p50 }}>● p50</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p50?.toFixed(1)}{sli.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p90 }}>● p90</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p90?.toFixed(1)}{sli.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p95 }}>● p95</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p95?.toFixed(1)}{sli.unit}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: colors.p99 }}>● p99</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {data.p99?.toFixed(1)}{sli.unit}
                </span>
              </div>
            </div>
            <div className="border-t border-neutral-200 dark:border-neutral-700 mt-2 pt-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-neutral-600 dark:text-neutral-400">Target</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {sli.target}{sli.unit}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600 dark:text-neutral-400">Success Rate</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {((data.good / (data.good + data.bad)) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Header with percentile badges */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Service Level Indicator
        </h3>
        {hasPercentiles && currentValues && (
          <div className="flex items-center gap-1.5">
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              p50: {currentValues.p50?.toFixed(0)}{sli.unit}
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              p90: {currentValues.p90?.toFixed(0)}{sli.unit}
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              p95: {currentValues.p95?.toFixed(0)}{sli.unit}
            </div>
            <div className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              p99: {currentValues.p99?.toFixed(0)}{sli.unit}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 40, left: 60, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={darkMode ? '#374151' : '#e5e7eb'}
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            stroke={darkMode ? '#9ca3af' : '#6b7280'}
            tick={{ fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            stroke={darkMode ? '#9ca3af' : '#6b7280'}
            tick={{ fontSize: 11 }}
            tickLine={false}
            domain={yDomain}
            tickFormatter={(value) => hasPercentiles ? `${Math.round(value)}` : `${value.toFixed(1)}`}
            label={{
              value: sli.unit === 'ms' ? 'Latency (ms)' : 'Success Rate (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: darkMode ? '#9ca3af' : '#6b7280' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Breach period shading (pink areas) */}
          {breaches.map((breach, i) => {
            const startTime = new Date(breach.start).getTime();
            const endTime = new Date(breach.end).getTime();
            return (
              <ReferenceArea
                key={`breach-${i}`}
                x1={startTime}
                x2={endTime}
                fill={colors.breach}
                fillOpacity={1}
              />
            );
          })}

          {/* Target threshold line */}
          <ReferenceLine
            y={sli.target}
            stroke={colors.target}
            strokeDasharray="5 5"
            strokeWidth={2}
            label={{
              value: `Target: ${sli.target}${sli.unit}`,
              position: 'right',
              style: { fontSize: 10, fill: colors.target },
            }}
          />

          {/* Percentile lines */}
          {hasPercentiles ? (
            <>
              <Line
                type="monotone"
                dataKey="p50"
                stroke={colors.p50}
                strokeWidth={2}
                dot={false}
                name="p50"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p90"
                stroke={colors.p90}
                strokeWidth={2}
                dot={false}
                name="p90"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke={colors.p95}
                strokeWidth={2}
                dot={false}
                name="p95"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="p99"
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
              dataKey={(d: any) => (d.good / (d.good + d.bad)) * 100}
              stroke={colors.p95}
              strokeWidth={2}
              dot={false}
              name="Success Rate"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

