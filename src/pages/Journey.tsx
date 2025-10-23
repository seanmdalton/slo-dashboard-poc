import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useData } from "../store/useData";
import type { Journey as JourneyType, SLO, SLI } from "../models/slo";
import {
  getCurrentSLIValue,
  isSLIMeetingObjective,
  calculateErrorBudget,
  calculateBurnRates,
  getBurnRateStatus,
  sliceTimeWindow
} from "../lib/sloMath";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import ErrorBudgetHeatmap from "../components/ErrorBudgetHeatmap";
import IncidentTimeline from "../components/IncidentTimeline";
import BurnBar from "../components/BurnBar";

export default function Journey() {
  const { id } = useParams<{ id: string }>();
  const { seed, series } = useData();
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [expandedSLOs, setExpandedSLOs] = useState<Record<string, boolean>>({});

  // Find the journey
  const journey: JourneyType | undefined = useMemo(() => {
    for (const exp of seed.experiences) {
      const found = exp.journeys.find((j: JourneyType) => j.id === id);
      if (found) return found;
    }
    return undefined;
  }, [id, seed.experiences]);

  // Get unique owners
  const owners = useMemo(() => {
    if (!journey) return [];
    return [...new Set(journey.slos.map(slo => slo.owner))].sort();
  }, [journey]);

  // Calculate SLO statuses
  const sloStatuses = useMemo(() => {
    if (!journey) return new Map();
    
    const statuses = new Map<string, { 
      meetsObjective: boolean; 
      status: "ok" | "warn" | "critical";
      errorBudget: ReturnType<typeof calculateErrorBudget>;
    }>();
    
    journey.slos.forEach(slo => {
      const primarySLI = slo.indicators[0];
      if (!primarySLI) return;
      
      const data = series[primarySLI.id] || [];
      const windowData = sliceTimeWindow(data, 28 * 24 * 60 * 60 * 1000);
      const currentValue = getCurrentSLIValue(primarySLI, windowData);
      const meetsObjective = isSLIMeetingObjective(primarySLI, currentValue);
      const errorBudget = calculateErrorBudget(currentValue, slo.objectivePercent);
      const burnRates = calculateBurnRates(data, primarySLI, slo.objectivePercent);
      
      const maxBurnRate = Math.max(burnRates["1h"], burnRates["6h"], burnRates["24h"], burnRates["3d"]);
      const status = getBurnRateStatus(maxBurnRate);
      
      statuses.set(slo.id, { meetsObjective, status, errorBudget });
      
      // Auto-expand if at risk or breaching
      if (status !== "ok") {
        setExpandedSLOs(prev => ({ ...prev, [slo.id]: true }));
      }
    });
    
    return statuses;
  }, [journey, series]);

  // Group SLOs by tier
  const slosByTier = useMemo(() => {
    if (!journey) return { "tier-0": [], "tier-1": [], "tier-2": [] };
    
    const filtered = selectedOwner === "all" 
      ? journey.slos 
      : journey.slos.filter(slo => slo.owner === selectedOwner);
    
    return {
      "tier-0": filtered.filter(slo => slo.criticality === "tier-0"),
      "tier-1": filtered.filter(slo => slo.criticality === "tier-1"),
      "tier-2": filtered.filter(slo => slo.criticality === "tier-2")
    };
  }, [journey, selectedOwner]);

  // Count issues
  const issueCount = useMemo(() => {
    let breaching = 0;
    let atRisk = 0;
    sloStatuses.forEach(({ status }) => {
      if (status === "critical") breaching++;
      if (status === "warn") atRisk++;
    });
    return { breaching, atRisk };
  }, [sloStatuses]);

  // Calculate tier health for all tiers upfront
  const tierHealthMap = useMemo(() => {
    const map = new Map<string, { meeting: number; atRisk: number; breaching: number; total: number }>();
    (["tier-0", "tier-1", "tier-2"] as const).forEach(tier => {
      const slos = slosByTier[tier];
      let meeting = 0, atRisk = 0, breaching = 0;
      slos.forEach((slo) => {
        const status = sloStatuses.get(slo.id);
        if (status) {
          if (status.status === "ok") meeting++;
          else if (status.status === "warn") atRisk++;
          else breaching++;
        }
      });
      map.set(tier, { meeting, atRisk, breaching, total: slos.length });
    });
    return map;
  }, [slosByTier, sloStatuses]);

  const toggleTier = (tier: string) => {
    setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  const toggleSLO = (sloId: string) => {
    setExpandedSLOs(prev => ({ ...prev, [sloId]: !prev[sloId] }));
  };

  if (!journey) {
    return (
      <div className="min-h-screen bg-neutral-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="text-xl text-neutral-600">Journey not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link to="/" className="text-blue-600 hover:underline mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900">{journey.name}</h1>
          <p className="text-neutral-600 mt-1">{journey.experience} Experience</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Alert Banner */}
        {(issueCount.breaching > 0 || issueCount.atRisk > 0) && (
          <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-semibold text-amber-900">
                  {issueCount.breaching > 0 && `${issueCount.breaching} SLO${issueCount.breaching > 1 ? 's' : ''} breaching`}
                  {issueCount.breaching > 0 && issueCount.atRisk > 0 && " • "}
                  {issueCount.atRisk > 0 && `${issueCount.atRisk} at risk`}
                </div>
                <div className="text-sm text-amber-700">Review expanded SLOs below for details</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-neutral-700">Filter by owner:</label>
          <select 
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
          >
            <option value="all">All teams ({journey.slos.length} SLOs)</option>
            {owners.map(owner => {
              const count = journey.slos.filter(slo => slo.owner === owner).length;
              return (
                <option key={owner} value={owner}>
                  {owner} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* Tier Sections */}
        <div className="space-y-4">
          {(["tier-0", "tier-1", "tier-2"] as const).map(tier => {
            const slos = slosByTier[tier];
            if (slos.length === 0) return null;
            
            const tierLabel = tier === "tier-0" ? "🔴 Tier-0 Critical" : tier === "tier-1" ? "🟡 Tier-1 Important" : "⚪ Tier-2 Standard";
            const isExpanded = expandedTiers[tier];
            
            // Get tier health from precomputed map
            const tierHealth = tierHealthMap.get(tier) || { meeting: 0, atRisk: 0, breaching: 0, total: 0 };
            
            return (
              <div key={tier} className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
                {/* Tier Header */}
                <button
                  onClick={() => toggleTier(tier)}
                  className="w-full px-6 py-4 bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{isExpanded ? "▼" : "▶"}</span>
                      <span className="text-lg font-bold text-neutral-900">
                        {tierLabel} ({slos.length} SLO{slos.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-700 font-medium">{tierHealth.meeting} ✓</span>
                      {tierHealth.atRisk > 0 && <span className="text-amber-700 font-medium">{tierHealth.atRisk} ⚠</span>}
                      {tierHealth.breaching > 0 && <span className="text-red-700 font-medium">{tierHealth.breaching} ✗</span>}
                    </div>
                  </div>
                  
                  {/* Health visualization */}
                  <div className="flex items-center gap-3 ml-11">
                    {/* Stacked bar */}
                    <div className="flex-1 max-w-md h-2 bg-neutral-200 rounded-full overflow-hidden flex">
                      {tierHealth.meeting > 0 && (
                        <div 
                          className="bg-green-500 h-full" 
                          style={{ width: `${(tierHealth.meeting / tierHealth.total) * 100}%` }}
                        />
                      )}
                      {tierHealth.atRisk > 0 && (
                        <div 
                          className="bg-amber-500 h-full" 
                          style={{ width: `${(tierHealth.atRisk / tierHealth.total) * 100}%` }}
                        />
                      )}
                      {tierHealth.breaching > 0 && (
                        <div 
                          className="bg-red-500 h-full" 
                          style={{ width: `${(tierHealth.breaching / tierHealth.total) * 100}%` }}
                        />
                      )}
                    </div>
                    
                    {/* Status dots */}
                    <div className="flex items-center gap-1">
                      {slos.map(slo => {
                        const status = sloStatuses.get(slo.id);
                        const dotColor = !status ? "bg-neutral-400" :
                          status.status === "ok" ? "bg-green-500" :
                          status.status === "warn" ? "bg-amber-500" : "bg-red-500";
                        return (
                          <div 
                            key={slo.id}
                            className={`w-2 h-2 rounded-full ${dotColor}`}
                            title={slo.name}
                          />
                        );
                      })}
                    </div>
                  </div>
                </button>

                {/* SLO Cards */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {slos.map(slo => (
                      <SLOCard
                        key={slo.id}
                        slo={slo}
                        seriesData={series}
                        status={sloStatuses.get(slo.id)}
                        isExpanded={expandedSLOs[slo.id] || false}
                        onToggle={() => toggleSLO(slo.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// Collapsible SLO Card Component
interface SLOCardProps {
  slo: SLO;
  seriesData: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
  status?: { meetsObjective: boolean; status: "ok" | "warn" | "critical"; errorBudget: { errorBudgetPercent: number; spent: number; remaining: number; spentPercent: number; remainingPercent: number } };
  isExpanded: boolean;
  onToggle: () => void;
}

function SLOCard({ 
  slo, 
  seriesData, 
  status,
  isExpanded,
  onToggle 
}: SLOCardProps) {
  const primarySLI = slo.indicators[0];
  const data = seriesData[primarySLI?.id] || [];

  // Calculate metrics
  const windowData = sliceTimeWindow(data, 28 * 24 * 60 * 60 * 1000);
  const currentValue = getCurrentSLIValue(primarySLI, windowData);
  const meetsObjective = status?.meetsObjective ?? isSLIMeetingObjective(primarySLI, currentValue);
  // Always calculate full error budget to have all properties available
  const errorBudget = calculateErrorBudget(currentValue, slo.objectivePercent);
  const burnRates = calculateBurnRates(data, primarySLI, slo.objectivePercent);

  const getStatusColor = () => {
    if (!status) return "bg-neutral-100 text-neutral-800";
    if (status.status === "ok") return "bg-green-100 text-green-800";
    if (status.status === "warn") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusText = () => {
    if (!status) return "Unknown";
    if (status.status === "ok") return "✓ Meeting";
    if (status.status === "warn") return "⚠ At Risk";
    return "✗ Breaching";
  };

  const getTierColor = (tier: string) => {
    if (tier === "tier-0") return "bg-purple-100 text-purple-800 border-purple-300";
    if (tier === "tier-1") return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-neutral-100 text-neutral-800 border-neutral-300";
  };

  // Prepare chart data (last 7 days)
  const chartData = useMemo(() => {
    const last7Days = sliceTimeWindow(data, 7 * 24 * 60 * 60 * 1000);
    return last7Days.map(point => {
      if (primarySLI.type === "latency") {
        return {
          time: new Date(point.t).toLocaleDateString(),
          value: point.value ?? 0,
          target: primarySLI.target
        };
      } else {
        const total = point.good + point.bad;
        const pct = total > 0 ? (point.good / total) * 100 : 100;
        return {
          time: new Date(point.t).toLocaleDateString(),
          value: pct,
          target: primarySLI.target
        };
      }
    });
  }, [data, primarySLI]);

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Collapsed Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <span className="text-neutral-400">{isExpanded ? "▼" : "▶"}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-neutral-900">{slo.name}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTierColor(slo.criticality)}`}>
                {slo.criticality}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div className="text-sm text-neutral-600">
              <span className="font-medium">Owner:</span> {slo.owner} • 
              <span className="font-medium"> Objective:</span> {slo.objectivePercent}% • 
              <span className="font-medium"> Budget remaining:</span> {errorBudget.remainingPercent.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-48">
            <BurnBar spent={errorBudget.spent} label="" />
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="border-t border-neutral-200 p-6 bg-white">
          {/* Description */}
          <p className="text-neutral-600 mb-4">{slo.description}</p>

          {/* Error Budget */}
          <div className="mb-6 p-4 bg-neutral-50 rounded-xl">
            <BurnBar spent={errorBudget.spent} label="Error Budget (28d)" />
          </div>

          {/* Burn Rate Tiles */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Burn Rate Windows</h3>
            <div className="grid grid-cols-4 gap-3">
              {(["1h", "6h", "24h", "3d"] as const).map(window => {
                const rate = burnRates[window];
                const status = getBurnRateStatus(rate);
                const colorClass = status === "ok" 
                  ? "bg-green-50 border-green-200 text-green-800"
                  : status === "warn"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-red-50 border-red-200 text-red-800";

                return (
                  <div key={window} className={`p-3 rounded-lg border ${colorClass}`}>
                    <div className="text-xs font-medium opacity-75">{window}</div>
                    <div className="text-2xl font-bold">{rate.toFixed(2)}x</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SLIs Table */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Service Level Indicators</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left p-3 font-medium text-neutral-700">Name</th>
                    <th className="text-left p-3 font-medium text-neutral-700">Type</th>
                    <th className="text-left p-3 font-medium text-neutral-700">Target</th>
                    <th className="text-left p-3 font-medium text-neutral-700">Current</th>
                    <th className="text-left p-3 font-medium text-neutral-700">Source</th>
                    <th className="text-left p-3 font-medium text-neutral-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {slo.indicators.map((sli: SLI) => {
                    const sliData = seriesData[sli.id] || [];
                    const sliWindowData = sliceTimeWindow(sliData, 28 * 24 * 60 * 60 * 1000);
                    const sliValue = getCurrentSLIValue(sli, sliWindowData);
                    const sliMeets = isSLIMeetingObjective(sli, sliValue);

                    return (
                      <tr key={sli.id} className="border-b border-neutral-100">
                        <td className="p-3 font-medium">{sli.name}</td>
                        <td className="p-3 capitalize">{sli.type}</td>
                        <td className="p-3">
                          {sli.objectiveDirection === "gte" ? "≥" : "≤"} {sli.target}
                          {sli.unit === "percent" ? "%" : sli.unit}
                        </td>
                        <td className="p-3 font-medium">
                          {sliValue.toFixed(2)}
                          {sli.unit === "percent" ? "%" : sli.unit}
                        </td>
                        <td className="p-3 capitalize">{sli.source}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            sliMeets ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {sliMeets ? "Meeting" : "Not Meeting"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Primary SLI Chart */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-700 mb-2">
              {primarySLI.name} - Last 7 Days
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    domain={primarySLI.type === "latency" ? ["auto", "auto"] : [95, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#fff", 
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px" 
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="target"
                    stroke="#9ca3af"
                    fill="transparent"
                    strokeDasharray="5 5"
                    name="Target"
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={meetsObjective ? "#10b981" : "#ef4444"}
                    fill={meetsObjective ? "#d1fae5" : "#fee2e2"}
                    name={primarySLI.name}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Error Budget Heatmap */}
          <div className="mb-6">
            <ErrorBudgetHeatmap data={data} sli={primarySLI} />
          </div>

          {/* Incident Timeline */}
          <div>
            <IncidentTimeline data={data} sli={primarySLI} />
          </div>
        </div>
      )}
    </div>
  );
}
