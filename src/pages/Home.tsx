import { useMemo, useState, useEffect } from "react";
import { useData } from "../store/useData";
import type { ExperienceRollup, SLO } from "../models/slo";
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

export default function Home() {
  const { seed, series } = useData();
  const experiences: ExperienceRollup[] = seed.experiences;
  
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [expandedExperiences, setExpandedExperiences] = useState<Record<string, boolean>>({});
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [expandedSLOs, setExpandedSLOs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || false;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Calculate all SLO statuses
  const allSLOStatuses = useMemo(() => {
    const statuses = new Map<string, { 
      meetsObjective: boolean; 
      status: "ok" | "warn" | "critical";
      errorBudget: ReturnType<typeof calculateErrorBudget>;
    }>();
    
    experiences.forEach(exp => {
      exp.journeys.forEach(journey => {
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
        });
      });
    });
    
    return statuses;
  }, [experiences, series]);

  // Calculate experience health
  const experienceHealth = useMemo(() => {
    return experiences.map(exp => {
      let meeting = 0, atRisk = 0, breaching = 0, total = 0;
      
      exp.journeys.forEach(journey => {
        journey.slos.forEach(slo => {
          const status = allSLOStatuses.get(slo.id);
          if (status) {
            total++;
            if (status.status === "ok") meeting++;
            else if (status.status === "warn") atRisk++;
            else breaching++;
          }
        });
      });
      
      const healthPercent = total > 0 ? (meeting / total) * 100 : 100;
      return { name: exp.name, meeting, atRisk, breaching, total, healthPercent };
    });
  }, [experiences, allSLOStatuses]);

  // Get all unique owners
  const allOwners = useMemo(() => {
    const owners = new Set<string>();
    experiences.forEach(exp => {
      exp.journeys.forEach(journey => {
        journey.slos.forEach(slo => owners.add(slo.owner));
      });
    });
    return Array.from(owners).sort();
  }, [experiences]);

  // Global issue count
  const globalIssues = useMemo(() => {
    let breaching = 0, atRisk = 0;
    allSLOStatuses.forEach(({ status }) => {
      if (status === "critical") breaching++;
      if (status === "warn") atRisk++;
    });
    return { breaching, atRisk };
  }, [allSLOStatuses]);

  const toggleExperience = (name: string) => {
    setExpandedExperiences(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const selectJourney = (journeyId: string) => {
    setSelectedJourneyId(journeyId);
    setMobileMenuOpen(false); // Close mobile menu when selecting a journey
    // Auto-expand the tiers for breaching SLOs in this journey
    const journey = experiences.flatMap(exp => exp.journeys).find(j => j.id === journeyId);
    if (journey) {
      journey.slos.forEach(slo => {
        const status = allSLOStatuses.get(slo.id);
        if (status && status.status !== "ok") {
          setExpandedSLOs(prev => ({ ...prev, [slo.id]: true }));
          setExpandedTiers(prev => ({ ...prev, [`${journeyId}-${slo.criticality}`]: true }));
        }
      });
    }
  };

  // Find the selected journey
  const selectedJourney = selectedJourneyId 
    ? experiences.flatMap(exp => exp.journeys).find(j => j.id === selectedJourneyId)
    : null;

  return (
    <div className="h-screen flex flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* Top Header */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm flex-shrink-0">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <div className="flex-1 lg:flex-initial">
              <h1 className="text-lg md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                🚗 Sean's Automotive Parts & More
              </h1>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 mt-1">SLO Dashboard</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <input
                type="text"
                placeholder="Search SLOs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hidden md:block px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm w-64 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 min-h-[44px]"
              />
              <select 
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="hidden sm:block px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
              >
                <option value="all">All teams</option>
                {allOwners.map(owner => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-600 transition-colors min-h-[44px] min-w-[44px]"
                title="Toggle dark mode"
                aria-label="Toggle dark mode"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 
          w-80 bg-white dark:bg-neutral-800 
          border-r border-neutral-200 dark:border-neutral-700 
          overflow-y-auto flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-4">
            <h2 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-3">Experiences</h2>
            
            {experiences.map((exp, idx) => {
              const health = experienceHealth[idx];
              const isExpanded = expandedExperiences[exp.name];
              
              return (
                <div key={exp.name} className="mb-4">
                  <button
                    onClick={() => toggleExperience(exp.name)}
                    className="w-full text-left p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors min-h-[44px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400 dark:text-neutral-500">{isExpanded ? "▼" : "▶"}</span>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{exp.name}</span>
                      </div>
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {health.healthPercent.toFixed(0)}%
                      </span>
                    </div>
                    {/* Stacked bar visualization only */}
                    <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
                      {health.meeting > 0 && (
                        <div
                          className="bg-green-500 dark:bg-green-600 h-full"
                          style={{ width: `${(health.meeting / health.total) * 100}%` }}
                        />
                      )}
                      {health.atRisk > 0 && (
                        <div
                          className="bg-amber-500 dark:bg-amber-600 h-full"
                          style={{ width: `${(health.atRisk / health.total) * 100}%` }}
                        />
                      )}
                      {health.breaching > 0 && (
                        <div
                          className="bg-red-500 dark:bg-red-600 h-full"
                          style={{ width: `${(health.breaching / health.total) * 100}%` }}
                        />
                      )}
                    </div>
                  </button>
                  
                  {/* Journey list */}
                  {expandedExperiences[exp.name] && (
                    <div className="ml-4 mt-2 space-y-1">
                      {exp.journeys.map(journey => {
                        const journeyIssues = journey.slos.filter(slo => {
                          const status = allSLOStatuses.get(slo.id);
                          return status && status.status !== "ok";
                        }).length;
                        
                        const isSelected = selectedJourneyId === journey.id;
                        
                        return (
                          <button
                            key={journey.id}
                            onClick={() => selectJourney(journey.id)}
                            className={`w-full text-left px-3 py-2 rounded transition-colors text-sm min-h-[44px] ${
                              isSelected 
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400' 
                                : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 border-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={isSelected ? "text-blue-900 dark:text-blue-300 font-semibold" : "text-neutral-700 dark:text-neutral-300"}>
                                {journey.name}
                              </span>
                              {journeyIssues > 0 && (
                                <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-0.5 rounded-full">
                                  {journeyIssues}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {journey.slos.length} SLOs
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 md:p-6">
            {!selectedJourney ? (
              // Welcome screen when nothing is selected
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">🚗</div>
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    Welcome to Sean's Automotive SLO Dashboard
                  </h2>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                    Select a journey from the sidebar to view detailed SLO information, charts, and metrics.
                  </p>
                  
                  {/* Global Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
                      <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {experiences.reduce((acc, exp) => acc + exp.journeys.length, 0)}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">Journeys</div>
                    </div>
                    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
                      <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {allSLOStatuses.size}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">Total SLOs</div>
                    </div>
                    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-500">
                        {Array.from(allSLOStatuses.values()).filter(s => s.status === "ok").length}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">Meeting Targets</div>
                    </div>
                  </div>

                  {/* Alert if issues exist */}
                  {(globalIssues.breaching > 0 || globalIssues.atRisk > 0) && (
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <div className="font-semibold text-amber-900 dark:text-amber-300">
                            {globalIssues.breaching > 0 && `${globalIssues.breaching} SLO${globalIssues.breaching > 1 ? 's' : ''} breaching`}
                            {globalIssues.breaching > 0 && globalIssues.atRisk > 0 && " • "}
                            {globalIssues.atRisk > 0 && `${globalIssues.atRisk} at risk`}
                          </div>
                          <div className="text-sm text-amber-700 dark:text-amber-400">
                            Select a journey from the sidebar to view details
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Show selected journey
              <div>
                {/* Journey breadcrumb */}
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <button 
                    onClick={() => setSelectedJourneyId(null)}
                    className="text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] flex items-center"
                  >
                    ← Back to overview
                  </button>
                  <span>/</span>
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">{selectedJourney.name}</span>
                </div>

                <JourneySection
                  journey={selectedJourney}
                  expandedTiers={expandedTiers}
                  expandedSLOs={expandedSLOs}
                  setExpandedTiers={setExpandedTiers}
                  setExpandedSLOs={setExpandedSLOs}
                  sloStatuses={allSLOStatuses}
                  seriesData={series}
                  selectedOwner={selectedOwner}
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Journey Section Component
interface JourneySectionProps {
  journey: {
    id: string;
    name: string;
    slos: SLO[];
  };
  expandedTiers: { [key: string]: boolean };
  expandedSLOs: { [key: string]: boolean };
  setExpandedTiers: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  setExpandedSLOs: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  sloStatuses: Map<string, { meetsObjective: boolean; status: "ok" | "warn" | "critical"; errorBudget: { errorBudgetPercent: number; spent: number; remaining: number; spentPercent: number; remainingPercent: number } }>;
  seriesData: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
  selectedOwner: string;
  searchQuery: string;
}

function JourneySection({ journey, expandedTiers, expandedSLOs, setExpandedTiers, setExpandedSLOs, sloStatuses, seriesData, selectedOwner, searchQuery }: JourneySectionProps) {
  
  // Filter SLOs
  const filteredSLOs = useMemo(() => {
    let filtered = journey.slos;
    
    if (selectedOwner !== "all") {
      filtered = filtered.filter((slo: SLO) => slo.owner === selectedOwner);
    }
    
    if (searchQuery) {
      filtered = filtered.filter((slo: SLO) => 
        slo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        slo.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [journey.slos, selectedOwner, searchQuery]);

  // Group by tier
  const slosByTier = useMemo(() => {
    return {
      "tier-0": filteredSLOs.filter((slo: SLO) => slo.criticality === "tier-0"),
      "tier-1": filteredSLOs.filter((slo: SLO) => slo.criticality === "tier-1"),
      "tier-2": filteredSLOs.filter((slo: SLO) => slo.criticality === "tier-2")
    };
  }, [filteredSLOs]);

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
    const key = `${journey.id}-${tier}`;
    setExpandedTiers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSLO = (sloId: string) => {
    setExpandedSLOs((prev) => ({ ...prev, [sloId]: !prev[sloId] }));
  };

  // Early return after all hooks
  if (filteredSLOs.length === 0) return null;

  return (
    <div id={`journey-${journey.id}`} className="space-y-3">
      {/* Tier Sections - no journey wrapper needed since it's already selected */}
      {(["tier-0", "tier-1", "tier-2"] as const).map(tier => {
            const slos = slosByTier[tier];
            if (slos.length === 0) return null;
            
            const tierKey = `${journey.id}-${tier}`;
            const tierLabel = tier === "tier-0" ? "Tier-0 Critical" : tier === "tier-1" ? "Tier-1 Important" : "Tier-2 Standard";
            const isTierExpanded = expandedTiers[tierKey];
            const tierHealth = tierHealthMap.get(tier) || { meeting: 0, atRisk: 0, breaching: 0, total: 0 };
            
            return (
              <div key={tier} className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 overflow-hidden">
                <button
                  onClick={() => toggleTier(tier)}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors min-h-[44px]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{isTierExpanded ? "▼" : "▶"}</span>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">
                        {tierLabel} ({slos.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-700 dark:text-green-500">{tierHealth.meeting} ✓</span>
                      {tierHealth.atRisk > 0 && <span className="text-amber-700 dark:text-amber-500">{tierHealth.atRisk} ⚠</span>}
                      {tierHealth.breaching > 0 && <span className="text-red-700 dark:text-red-500">{tierHealth.breaching} ✗</span>}
                    </div>
                  </div>
                  
                  {/* Stacked bar only - removed dots */}
                  <div className="ml-6">
                    <div className="h-2 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden flex">
                      {tierHealth.meeting > 0 && (
                        <div className="bg-green-500 dark:bg-green-600 h-full" style={{ width: `${(tierHealth.meeting / tierHealth.total) * 100}%` }} />
                      )}
                      {tierHealth.atRisk > 0 && (
                        <div className="bg-amber-500 dark:bg-amber-600 h-full" style={{ width: `${(tierHealth.atRisk / tierHealth.total) * 100}%` }} />
                      )}
                      {tierHealth.breaching > 0 && (
                        <div className="bg-red-500 dark:bg-red-600 h-full" style={{ width: `${(tierHealth.breaching / tierHealth.total) * 100}%` }} />
                      )}
                    </div>
                  </div>
                </button>

                {isTierExpanded && (
                  <div className="p-3 space-y-2">
                    {slos.map((slo: SLO) => (
                      <SLOCard
                        key={slo.id}
                        slo={slo}
                        seriesData={seriesData}
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
  );
}

// SLO Card Component (reused from Journey.tsx)
interface SLOCardProps {
  slo: SLO;
  seriesData: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
  status?: { meetsObjective: boolean; errorBudget: { errorBudgetPercent: number; spent: number; remaining: number; spentPercent: number; remainingPercent: number }; status: "ok" | "warn" | "critical" };
  isExpanded: boolean;
  onToggle: () => void;
}

function SLOCard({ slo, seriesData, status, isExpanded, onToggle }: SLOCardProps) {
  const primarySLI = slo.indicators[0];
  const data = seriesData[primarySLI?.id] || [];

  const windowData = sliceTimeWindow(data, 28 * 24 * 60 * 60 * 1000);
  const currentValue = getCurrentSLIValue(primarySLI, windowData);
  const meetsObjective = status?.meetsObjective ?? isSLIMeetingObjective(primarySLI, currentValue);
  // Always calculate full error budget to have all properties available
  const errorBudget = calculateErrorBudget(currentValue, slo.objectivePercent);
  const burnRates = calculateBurnRates(data, primarySLI, slo.objectivePercent);

  const getStatusColor = () => {
    if (!status) return "bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200";
    if (status.status === "ok") return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    if (status.status === "warn") return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300";
    return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
  };

  const getStatusText = () => {
    if (!status) return "Unknown";
    if (status.status === "ok") return "✓ Meeting";
    if (status.status === "warn") return "⚠ At Risk";
    return "✗ Breaching";
  };

  const getTierColor = (tier: string) => {
    if (tier === "tier-0") return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700";
    if (tier === "tier-1") return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    return "bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600";
  };

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
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 overflow-hidden">
      {/* Collapsed Header */}
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          <span className="text-neutral-400 dark:text-neutral-500 text-sm">{isExpanded ? "▼" : "▶"}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{slo.name}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTierColor(slo.criticality)}`}>
                {slo.criticality}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {slo.owner} • {slo.objectivePercent}% • {errorBudget.remainingPercent.toFixed(1)}% remaining
            </div>
          </div>
        </div>
        <div className="w-32">
          <BurnBar spent={errorBudget.spent} label="" />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-800 space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{slo.description}</p>

          {/* Burn Rates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(["1h", "6h", "24h", "3d"] as const).map(window => {
              const rate = burnRates[window];
              const status = getBurnRateStatus(rate);
              const colorClass = status === "ok" 
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                : status === "warn"
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300";

              return (
                <div key={window} className={`p-2 rounded border text-center ${colorClass}`}>
                  <div className="text-xs opacity-75">{window}</div>
                  <div className="text-lg font-bold">{rate.toFixed(2)}x</div>
                </div>
              );
            })}
          </div>

          {/* Chart - Hidden on mobile, shown on tablet+ */}
          <div className="hidden sm:block h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={primarySLI.type === "latency" ? ["auto", "auto"] : [95, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="target" stroke="#9ca3af" fill="transparent" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={meetsObjective ? "#10b981" : "#ef4444"}
                  fill={meetsObjective ? "#d1fae5" : "#fee2e2"}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Mobile: Simple summary instead of chart */}
          <div className="sm:hidden bg-neutral-50 dark:bg-neutral-700 rounded p-3 text-center">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Current Value</div>
            <div className={`text-2xl font-bold ${meetsObjective ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {primarySLI.type === "latency" 
                ? `${currentValue.toFixed(0)}ms` 
                : `${currentValue.toFixed(2)}%`
              }
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Target: {primarySLI.type === "latency" 
                ? `${primarySLI.objectiveDirection === "lte" ? "≤" : "≥"} ${primarySLI.target}ms` 
                : `${primarySLI.objectiveDirection === "lte" ? "≤" : "≥"} ${primarySLI.target}%`
              }
            </div>
          </div>

          {/* Heatmap & Timeline - Made horizontally scrollable on mobile */}
          <div className="overflow-x-auto">
            <ErrorBudgetHeatmap data={data} sli={primarySLI} />
          </div>
          <div className="overflow-x-auto">
            <IncidentTimeline data={data} sli={primarySLI} />
          </div>
        </div>
      )}
    </div>
  );
}
