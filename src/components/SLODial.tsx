import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface SLODialProps {
  value: number; // 0-100
  size?: number;
  label?: string;
}

export default function SLODial({ value, size = 120, label }: SLODialProps) {
  const data = [{ name: "compliance", value: Math.min(100, Math.max(0, value)) }];
  
  // Color based on value
  const getColor = () => {
    if (value >= 95) return "#10b981"; // green
    if (value >= 80) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <RadialBarChart
          width={size}
          height={size}
          cx={size / 2}
          cy={size / 2}
          innerRadius={size * 0.35}
          outerRadius={size * 0.45}
          barSize={size * 0.1}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background
            dataKey="value"
            cornerRadius={size * 0.05}
            fill={getColor()}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: getColor() }}>
              {value.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>
      {label && <div className="text-sm text-neutral-600 mt-2">{label}</div>}
    </div>
  );
}
