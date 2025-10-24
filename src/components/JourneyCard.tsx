import { Link } from "react-router-dom";
import type { Journey, DataPoint } from "../models/slo";
import SLISpark from "./SLISpark";
import BurnBar from "./BurnBar";

interface JourneyCardProps {
  journey: Journey;
  seriesData: Record<string, DataPoint[]>;
  errorBudget: { spent: number; remaining: number };
}

export default function JourneyCard({ journey, seriesData, errorBudget }: JourneyCardProps) {
  // Get tier mix
  const tiers = journey.slos.map(slo => slo.criticality);
  const tierCounts = tiers.reduce((acc, tier) => {
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get unique owners
  const owners = [...new Set(journey.slos.map(slo => slo.owner))];

  // Get primary SLI for each SLO (first indicator)
  const primarySLIs = journey.slos.map(slo => slo.indicators[0]).filter(Boolean);

  const getTierColor = (tier: string) => {
    if (tier === "tier-0") return "bg-purple-100 text-purple-800";
    if (tier === "tier-1") return "bg-blue-100 text-blue-800";
    return "bg-neutral-100 text-neutral-800";
  };

  return (
    <Link to={`/journey/${journey.id}`}>
      <div className="rounded-2xl bg-white border border-neutral-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-neutral-900 mb-2">{journey.name}</h3>
          
          {/* Tier chips */}
          <div className="flex items-center gap-2 mb-2">
            {Object.entries(tierCounts).map(([tier, count]) => (
              <span
                key={tier}
                className={`px-2 py-1 rounded text-xs font-medium ${getTierColor(tier)}`}
              >
                {count}× {tier}
              </span>
            ))}
          </div>

          {/* Owners */}
          <div className="text-sm text-neutral-600">
            <span className="font-medium">Owners:</span> {owners.join(", ")}
          </div>
        </div>

        {/* Mini sparklines */}
        {primarySLIs.length > 0 && (
          <div className="mb-4 space-y-2">
            {primarySLIs.slice(0, 3).map(sli => {
              const data = seriesData[sli.id] || [];
              return (
                <div key={sli.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-neutral-600 mb-1">{sli.name}</div>
                    <SLISpark data={data} sli={sli} width={200} height={32} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error budget bar */}
        <div className="pt-3 border-t border-neutral-200">
          <BurnBar spent={errorBudget.spent} label="28d Error Budget" />
        </div>
      </div>
    </Link>
  );
}
