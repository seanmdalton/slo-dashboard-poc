import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { DataPoint } from "../lib/sloMath";
import type { SLI } from "../models/slo";

interface SLISparkProps {
  data: DataPoint[];
  sli: SLI;
  width?: number;
  height?: number;
}

export default function SLISpark({ data, sli, width = 120, height = 40 }: SLISparkProps) {
  // Prepare chart data
  const chartData = data.slice(-168).map((point, idx) => { // Last 7 days (168 hours at 1hr intervals)
    if (sli.type === "latency") {
      return { idx, value: point.value ?? 0 };
    } else {
      // For availability-like metrics
      const total = point.good + point.bad;
      const pct = total > 0 ? (point.good / total) * 100 : 100;
      return { idx, value: pct };
    }
  });

  // Determine if it's meeting target
  const lastValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const isMeetingTarget = sli.objectiveDirection === "gte" 
    ? lastValue >= sli.target 
    : lastValue <= sli.target;

  const color = isMeetingTarget ? "#10b981" : "#ef4444";

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['auto', 'auto']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
