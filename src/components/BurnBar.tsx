interface BurnBarProps {
  spent: number; // 0-1
  label?: string;
}

export default function BurnBar({ spent, label = "Error Budget" }: BurnBarProps) {
  const remaining = Math.max(0, 1 - spent);
  const spentPercent = Math.min(100, spent * 100);
  const remainingPercent = remaining * 100;

  // Color based on remaining budget
  const getColor = () => {
    if (remainingPercent >= 50) return "bg-green-500 dark:bg-green-600";
    if (remainingPercent >= 20) return "bg-amber-500 dark:bg-amber-600";
    return "bg-red-500 dark:bg-red-600";
  };

  return (
    <div className="w-full">
      {label && <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-300`}
            style={{ width: `${remainingPercent}%` }}
          />
        </div>
        <div className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-12 text-right">
          {remainingPercent.toFixed(0)}%
        </div>
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
        {spentPercent.toFixed(1)}% spent
      </div>
    </div>
  );
}
