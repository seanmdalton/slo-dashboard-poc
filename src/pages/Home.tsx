import { useMemo, useState, useEffect, useRef } from "react";
import { useData } from "../store/useData";
import type { ExperienceRollup, SLO } from "../models/slo";
import {
  getCurrentSLIValue,
  isSLIMeetingObjective,
  calculateErrorBudget,
  calculateBurnRates,
  getBurnRateStatus,
  sliceTimeWindow,
  getLatencyCompliancePercent
} from "../lib/sloMath";
import IncidentTimeline from "../components/IncidentTimeline";
import BurnBar from "../components/BurnBar";
import { SLIChart } from "../components/SLIChart";
import { ReliabilityBurnDownChart } from "../components/ReliabilityBurnDownChart";
import { BurnRateChart } from "../components/BurnRateChart";

export default function Home() {
  const { seed, series, loading, error, fetchData } = useData();
  const experiences: ExperienceRollup[] = seed.experiences;
  const hasFetched = useRef(false);

  // Fetch data once on mount
  useEffect(() => {
    if (!hasFetched.current && experiences.length === 0 && !loading && !error) {
      hasFetched.current = true;
      fetchData();
    }
  }, [experiences.length, loading, error, fetchData]);
  
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [expandedExperiences, setExpandedExperiences] = useState<Record<string, boolean>>({});
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [expandedSLOs, setExpandedSLOs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Search filters
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Time range (fixed at 28 days)
  const timeRangeDays = 28;
  
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" - Focus search (only if not already in an input)
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      
      // "Escape" - Clear search or close mobile menu
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        } else if (selectedJourneyId) {
          setSelectedJourneyId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, mobileMenuOpen, selectedJourneyId]);

  // Calculate all SLO statuses
  const allSLOStatuses = useMemo(() => {
    const statuses = new Map<string, { 
      meetsObjective: boolean; 
      status: "ok" | "warn" | "critical";
      errorBudget: ReturnType<typeof calculateErrorBudget>;
    }>();
    
    const timeWindowMs = timeRangeDays * 24 * 60 * 60 * 1000;
    
    experiences.forEach(exp => {
      exp.journeys.forEach(journey => {
        journey.slos.forEach(slo => {
          const primarySLI = slo.indicators[0];
          if (!primarySLI) return;
          
          const data = series[primarySLI.id] || [];
          const windowData = sliceTimeWindow(data, timeWindowMs);
          const currentValue = getCurrentSLIValue(primarySLI, windowData);
          const meetsObjective = isSLIMeetingObjective(primarySLI, currentValue);
          
          // Convert to performance percentage for error budget calculation
          const performancePercent = primarySLI.type === "latency"
            ? getLatencyCompliancePercent(primarySLI, windowData) // % of time meeting target
            : currentValue; // Already a percentage for availability/quality/etc
          
          const errorBudget = calculateErrorBudget(performancePercent, slo.objectivePercent);
          const burnRates = calculateBurnRates(data, primarySLI, slo.objectivePercent);
          
          const maxBurnRate = Math.max(burnRates["1h"], burnRates["6h"], burnRates["24h"], burnRates["3d"]);
          const status = getBurnRateStatus(maxBurnRate);
          
          statuses.set(slo.id, { meetsObjective, status, errorBudget });
        });
      });
    });
    
    return statuses;
  }, [experiences, series, timeRangeDays]);

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

  // Recent changes: SLOs with significant trends
  const recentChanges = useMemo(() => {
    const changes: Array<{
      slo: SLO;
      experienceName: string;
      journeyName: string;
      journeyId: string;
      type: "worsening" | "improving" | "breaching";
      percentChange: number;
    }> = [];

    experiences.forEach(exp => {
      exp.journeys.forEach(journey => {
        journey.slos.forEach(slo => {
          const primarySLI = slo.indicators[0];
          if (!primarySLI) return;
          
          const data = series[primarySLI.id] || [];
          if (data.length < 14) return;
          
          // Use fixed demo data end date (display through Oct 23)
          const demoEndDate = new Date('2025-10-23T23:59:59Z').getTime();
          const last7Days = sliceTimeWindow(data, 7 * 24 * 60 * 60 * 1000);
          const previous7Days = data.filter(point => {
            const pointTime = new Date(point.t).getTime();
            const sevenDaysAgo = demoEndDate - (7 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = demoEndDate - (14 * 24 * 60 * 60 * 1000);
            return pointTime >= fourteenDaysAgo && pointTime < sevenDaysAgo;
          });
          
          if (previous7Days.length === 0) return;
          
          const recentValue = getCurrentSLIValue(primarySLI, last7Days);
          const previousValue = getCurrentSLIValue(primarySLI, previous7Days);
          
          const diff = Math.abs(recentValue - previousValue);
          const percentChange = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
          
          // Only show if change is significant (>2%)
          if (percentChange < 2) return;
          
          const status = allSLOStatuses.get(slo.id);
          let changeType: "worsening" | "improving" | "breaching";
          
          if (status?.status === "critical") {
            changeType = "breaching";
          } else if (primarySLI.objectiveDirection === "gte") {
            changeType = recentValue > previousValue ? "improving" : "worsening";
          } else {
            changeType = recentValue < previousValue ? "improving" : "worsening";
          }
          
          changes.push({
            slo,
            experienceName: exp.name,
            journeyName: journey.name,
            journeyId: journey.id,
            type: changeType,
            percentChange
          });
        });
      });
    });
    
    // Sort: breaching first, then worsening, then improving
    changes.sort((a, b) => {
      const typeOrder = { breaching: 0, worsening: 1, improving: 2 };
      if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
      return b.percentChange - a.percentChange;
    });
    
    return changes.slice(0, 10); // Top 10 changes
  }, [experiences, series, allSLOStatuses]);

  const toggleExperience = (name: string) => {
    setExpandedExperiences(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const selectJourney = (journeyId: string) => {
    setSelectedJourneyId(journeyId);
    setFilterOwner("all"); // Clear team filter when selecting a journey
    setMobileMenuOpen(false); // Close mobile menu when selecting a journey
    // Auto-expand the tiers for at-risk or breaching SLOs, but keep SLOs collapsed
    const journey = experiences.flatMap(exp => exp.journeys).find(j => j.id === journeyId);
    if (journey) {
      journey.slos.forEach(slo => {
        const status = allSLOStatuses.get(slo.id);
        if (status && status.status !== "ok") {
          // Only expand the tier, not the individual SLO
          setExpandedTiers(prev => ({ ...prev, [`${journeyId}-${slo.criticality}`]: true }));
        }
      });
    }
  };

  // Find the selected journey
  const selectedJourney = selectedJourneyId 
    ? experiences.flatMap(exp => exp.journeys).find(j => j.id === selectedJourneyId)
    : null;

  // Build flat list of all SLOs with context for search
  const allSLOsWithContext = useMemo(() => {
    const slos: Array<{
      slo: SLO;
      experienceName: string;
      journeyName: string;
      journeyId: string;
    }> = [];
    
    experiences.forEach(exp => {
      exp.journeys.forEach(journey => {
        journey.slos.forEach(slo => {
          slos.push({
            slo,
            experienceName: exp.name,
            journeyName: journey.name,
            journeyId: journey.id,
          });
        });
      });
    });
    
    return slos;
  }, [experiences]);

  // Filter SLOs based on search and filters
  const searchResults = useMemo(() => {
    // If no search query and no team filter, return empty (show main dashboard)
    if (!searchQuery.trim() && filterOwner === "all") return [];
    
    // Start with all SLOs if only filtering by team, otherwise filter by search query
    let results = searchQuery.trim()
      ? allSLOsWithContext.filter(({ slo }) => 
          slo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          slo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          slo.owner.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allSLOsWithContext;
    
    // Apply filters
    if (filterOwner !== "all") {
      results = results.filter(({ slo }) => slo.owner === filterOwner);
    }
    if (filterTier !== "all") {
      results = results.filter(({ slo }) => slo.criticality === filterTier);
    }
    if (filterStatus !== "all") {
      results = results.filter(({ slo }) => {
        const status = allSLOStatuses.get(slo.id);
        return status && status.status === filterStatus;
      });
    }
    
    return results;
  }, [searchQuery, allSLOsWithContext, filterOwner, filterTier, filterStatus, allSLOStatuses]);

  // Clear search when selecting a journey
  const selectJourneyAndClearSearch = (journeyId: string) => {
    setSearchQuery("");
    selectJourney(journeyId);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Loading SLO Dashboard...
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            Fetching data from API server
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Failed to Load Data
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {error}
          </p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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

            <button
              onClick={() => {
                setSelectedJourneyId(null);
                setSearchQuery('');
                setFilterOwner('all');
              }}
              className="flex-1 lg:flex-initial text-left hover:opacity-80 transition-opacity"
            >
              <h1 className="text-lg md:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                🚗 Sean's Automotive Parts & More
              </h1>
              <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-400 mt-1">SLO Dashboard</p>
            </button>
            <div className="flex items-center gap-2 md:gap-4">
              <select
                value={filterOwner}
                onChange={(e) => {
                  const team = e.target.value;
                  setFilterOwner(team);
                  if (team !== "all") {
                    // Clear search query and journey to show team filter view
                    setSearchQuery("");
                    setSelectedJourneyId(null);
                  }
                }}
                className="hidden sm:block px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
              >
                <option value="all">All Teams</option>
                {allOwners.map(owner => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search all SLOs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hidden md:block px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm w-64 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 min-h-[44px]"
              />
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

      {/* Demo Data Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 text-sm">
          <span className="text-blue-700 dark:text-blue-300">📊</span>
          <span className="text-blue-800 dark:text-blue-200 font-medium">
            Demo Data
          </span>
          <span className="text-blue-600 dark:text-blue-400">
            • Viewing performance data for September 26 - October 24, 2025
          </span>
        </div>
      </div>

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
            {/* Mobile Search */}
            <div className="mb-4 md:hidden">
              <input
                type="text"
                placeholder="Search all SLOs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 min-h-[44px]"
              />
            </div>

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
                            onClick={() => selectJourneyAndClearSearch(journey.id)}
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
            {searchQuery.trim() || filterOwner !== "all" ? (
              // Search Results View
              <SearchResultsView
                searchQuery={searchQuery}
                searchResults={searchResults}
                allOwners={allOwners}
                filterOwner={filterOwner}
                setFilterOwner={setFilterOwner}
                filterTier={filterTier}
                setFilterTier={setFilterTier}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                sloStatuses={allSLOStatuses}
                seriesData={series}
                expandedSLOs={expandedSLOs}
                setExpandedSLOs={setExpandedSLOs}
                onClearSearch={() => {
                  setSearchQuery("");
                  setFilterOwner("all");
                }}
                onSelectJourney={selectJourneyAndClearSearch}
                darkMode={darkMode}
                timeRangeDays={timeRangeDays}
              />
            ) : !selectedJourney ? (
              // Active Incidents Dashboard
              <div>
                {/* Active Incidents */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
                    🚨 Active Customer-Impacting Incidents
                  </h2>
                  
                  <div className="space-y-4 mb-8">
                    {/* P2 Incident */}
                    <div className="border-l-4 border-orange-500 bg-white dark:bg-neutral-800 rounded-r-lg overflow-hidden shadow-sm">
                      <button
                        onClick={() => setExpandedSLOs(prev => ({ ...prev, 'incident-p2': !prev['incident-p2'] }))}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-left min-h-[44px]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
                              P2
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              Customers Unable to Add Items to Cart
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Multiple reports of "Add to Cart" failures in the e-commerce experience. Error rate spike detected across cart services impacting checkout conversion. Investigating backend API performance degradation.
                          </p>
                        </div>
                        <span className="ml-4 text-neutral-400 dark:text-neutral-500">
                          {expandedSLOs['incident-p2'] ? '▼' : '▶'}
                        </span>
                      </button>
                      
                      {expandedSLOs['incident-p2'] && (
                        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700">
                          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Affected SLOs:</div>
                          <div className="space-y-2">
                            <button
                              onClick={() => selectJourneyAndClearSearch('journey-ecomm-cart')}
                              className="block w-full text-left px-3 py-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            >
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">Cart → Add to Cart Availability</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">Currently at risk (35% error budget remaining)</div>
                            </button>
                            <button
                              onClick={() => selectJourneyAndClearSearch('journey-ecomm-cart')}
                              className="block w-full text-left px-3 py-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            >
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">Cart → Cart Update Success Rate</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">Currently at risk (35% error budget remaining)</div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* P3 Incident */}
                    <div className="border-l-4 border-yellow-500 bg-white dark:bg-neutral-800 rounded-r-lg overflow-hidden shadow-sm">
                      <button
                        onClick={() => setExpandedSLOs(prev => ({ ...prev, 'incident-p3': !prev['incident-p3'] }))}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors text-left min-h-[44px]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                              P3
                            </span>
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                              Elevated Store Locator Search Latency
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            Store locator queries experiencing degraded response times. Users may notice slower "Find in Store" results and inventory lookups. Database query optimization in progress to restore performance.
                          </p>
                        </div>
                        <span className="ml-4 text-neutral-400 dark:text-neutral-500">
                          {expandedSLOs['incident-p3'] ? '▼' : '▶'}
                        </span>
                      </button>
                      
                      {expandedSLOs['incident-p3'] && (
                        <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-700">
                          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Affected SLOs:</div>
                          <div className="space-y-2">
                            <button
                              onClick={() => selectJourneyAndClearSearch('journey-ecomm-store-locator')}
                              className="block w-full text-left px-3 py-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            >
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">Store Locator → Store Locator Availability</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">Breached (5% error budget remaining)</div>
                            </button>
                            <button
                              onClick={() => selectJourneyAndClearSearch('journey-ecomm-store-locator')}
                              className="block w-full text-left px-3 py-2 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                            >
                              <div className="font-medium text-neutral-900 dark:text-neutral-100">Store Locator → Inventory Check Latency</div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">Breached (5% error budget remaining)</div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Global Stats - Single Row */}
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                    📊 SLO Overview
                  </h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
                      <div className="text-3xl font-bold text-red-600 dark:text-red-500">
                        {globalIssues.breaching}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">SLOs Breaching</div>
                    </div>
                  </div>
                </div>

                {/* Recent Changes Feed - Full width */}
                {recentChanges.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                      📊 Recent Changes
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {recentChanges.map(({ slo, experienceName, journeyName, journeyId, type, percentChange }) => (
                        <button
                          key={slo.id}
                          onClick={() => selectJourneyAndClearSearch(journeyId)}
                          className="w-full text-left p-4 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors min-h-[44px]"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                                  type === "breaching" 
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    : type === "worsening"
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                }`}>
                                  {type === "breaching" ? "✗ Breaching" : type === "worsening" ? "↘ Worsening" : "↗ Improving"}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{slo.name}</span>
                              </div>
                              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                                {experienceName} → {journeyName}
                              </div>
                              <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                                {percentChange.toFixed(1)}% change vs last week
                              </div>
                            </div>
                            <span className="text-neutral-400 dark:text-neutral-500 flex-shrink-0">→</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  darkMode={darkMode}
                  timeRangeDays={timeRangeDays}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Search Results View Component
interface SearchResultsViewProps {
  searchQuery: string;
  searchResults: Array<{
    slo: SLO;
    experienceName: string;
    journeyName: string;
    journeyId: string;
  }>;
  allOwners: string[];
  filterOwner: string;
  setFilterOwner: (owner: string) => void;
  filterTier: string;
  setFilterTier: (tier: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  sloStatuses: Map<string, { meetsObjective: boolean; status: "ok" | "warn" | "critical"; errorBudget: { errorBudgetPercent: number; spent: number; remaining: number; spentPercent: number; remainingPercent: number } }>;
  seriesData: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
  expandedSLOs: { [key: string]: boolean };
  setExpandedSLOs: React.Dispatch<React.SetStateAction<{ [key: string]: boolean }>>;
  onClearSearch: () => void;
  onSelectJourney: (journeyId: string) => void;
  darkMode?: boolean;
  timeRangeDays?: number;
}

function SearchResultsView({ 
  searchQuery, 
  searchResults, 
  allOwners, 
  filterOwner, 
  setFilterOwner, 
  filterTier, 
  setFilterTier, 
  filterStatus, 
  setFilterStatus, 
  sloStatuses, 
  seriesData, 
  expandedSLOs, 
  setExpandedSLOs,
  onClearSearch,
  onSelectJourney,
  darkMode = false,
  timeRangeDays = 28
}: SearchResultsViewProps) {
  
  const toggleSLO = (sloId: string) => {
    setExpandedSLOs((prev) => ({ ...prev, [sloId]: !prev[sloId] }));
  };

  // Calculate summary stats for search results
  const summaryStats = useMemo(() => {
    let meeting = 0;
    let atRisk = 0;
    let breaching = 0;
    let totalErrorBudget = 0;
    
    searchResults.forEach(({ slo }) => {
      const status = sloStatuses.get(slo.id);
      if (status) {
        if (status.status === "ok") meeting++;
        else if (status.status === "warn") atRisk++;
        else breaching++;
        totalErrorBudget += status.errorBudget.remainingPercent;
      }
    });
    
    const avgErrorBudget = searchResults.length > 0 ? totalErrorBudget / searchResults.length : 100;
    
    return {
      total: searchResults.length,
      meeting,
      atRisk,
      breaching,
      avgErrorBudget,
      healthPercent: searchResults.length > 0 ? (meeting / searchResults.length) * 100 : 0
    };
  }, [searchResults, sloStatuses]);

  return (
    <div>
      {/* Search Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {searchQuery.trim() ? 'Search Results' : filterOwner !== "all" ? `Team: ${filterOwner}` : 'Filtered Results'}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {searchQuery.trim() 
                ? `Found ${searchResults.length} SLO${searchResults.length !== 1 ? 's' : ''} matching "${searchQuery}"`
                : filterOwner !== "all"
                ? `${searchResults.length} SLO${searchResults.length !== 1 ? 's' : ''} owned by ${filterOwner}`
                : `${searchResults.length} SLO${searchResults.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <button
            onClick={onClearSearch}
            className="px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline min-h-[44px]"
          >
            {searchQuery.trim() ? 'Clear search' : 'Back to overview'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Filter by:</span>
          </div>
          
          {/* Owner Filter */}
          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
          >
            <option value="all">All Teams</option>
            {allOwners.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>

          {/* Tier Filter */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
          >
            <option value="all">All Tiers</option>
            <option value="tier-0">Tier-0 Critical</option>
            <option value="tier-1">Tier-1 Important</option>
            <option value="tier-2">Tier-2 Standard</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
          >
            <option value="all">All Statuses</option>
            <option value="ok">✓ Meeting</option>
            <option value="warn">⚠ At Risk</option>
            <option value="critical">✗ Breaching</option>
          </select>

          {/* Clear Filters */}
          {(filterOwner !== "all" || filterTier !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => {
                setFilterOwner("all");
                setFilterTier("all");
                setFilterStatus("all");
              }}
              className="px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {searchResults.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total SLOs */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total SLOs</div>
            <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
              {summaryStats.total}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              In search results
            </div>
          </div>

          {/* Meeting Targets */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Meeting Targets</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">
              {summaryStats.meeting}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {summaryStats.healthPercent.toFixed(0)}% healthy
            </div>
          </div>

          {/* At Risk */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">At Risk</div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">
              {summaryStats.atRisk}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              20-50% budget remaining
            </div>
          </div>

          {/* Breaching */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Breaching</div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-500">
              {summaryStats.breaching}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              &lt;20% budget remaining
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {searchResults.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-neutral-600 dark:text-neutral-400">
            No SLOs found matching your search and filters
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {searchResults.map(({ slo, experienceName, journeyName, journeyId }) => (
            <div key={slo.id} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {/* Context Header */}
              <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-700/50 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span>{experienceName}</span>
                    <span>→</span>
                    <button
                      onClick={() => onSelectJourney(journeyId)}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {journeyName}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* SLO Card */}
              <SLOCard
                slo={slo}
                seriesData={seriesData}
                status={sloStatuses.get(slo.id)}
                isExpanded={expandedSLOs[slo.id] || false}
                onToggle={() => toggleSLO(slo.id)}
                darkMode={darkMode}
                timeRangeDays={timeRangeDays}
              />
            </div>
          ))}
        </div>
      )}
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
  darkMode?: boolean;
  timeRangeDays?: number;
}

function JourneySection({ journey, expandedTiers, expandedSLOs, setExpandedTiers, setExpandedSLOs, sloStatuses, seriesData, darkMode = false, timeRangeDays = 28 }: JourneySectionProps) {
  
  // Sort and filter state
  const [sortBy, setSortBy] = useState<"status" | "errorBudget" | "burnRate" | "name">("status");
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  
  // Filter and sort SLOs
  const filteredSLOs = useMemo(() => {
    let slos = [...journey.slos];
    
    // Filter: show only issues
    if (showOnlyIssues) {
      slos = slos.filter(slo => {
        const status = sloStatuses.get(slo.id);
        return status && status.status !== "ok";
      });
    }
    
    // Sort
    slos.sort((a, b) => {
      if (sortBy === "status") {
        const statusA = sloStatuses.get(a.id);
        const statusB = sloStatuses.get(b.id);
        const statusOrder = { critical: 0, warn: 1, ok: 2 };
        const orderA = statusA ? statusOrder[statusA.status] : 3;
        const orderB = statusB ? statusOrder[statusB.status] : 3;
        return orderA - orderB;
      }
      
      if (sortBy === "errorBudget") {
        const statusA = sloStatuses.get(a.id);
        const statusB = sloStatuses.get(b.id);
        const remainingA = statusA?.errorBudget.remainingPercent ?? 100;
        const remainingB = statusB?.errorBudget.remainingPercent ?? 100;
        return remainingA - remainingB; // Ascending (worst first)
      }
      
      if (sortBy === "burnRate") {
        const dataA = seriesData[a.indicators[0]?.id] || [];
        const dataB = seriesData[b.indicators[0]?.id] || [];
        const burnA = a.indicators[0] ? calculateBurnRates(dataA, a.indicators[0], a.objectivePercent) : { "1h": 0, "6h": 0, "24h": 0, "3d": 0 };
        const burnB = b.indicators[0] ? calculateBurnRates(dataB, b.indicators[0], b.objectivePercent) : { "1h": 0, "6h": 0, "24h": 0, "3d": 0 };
        const maxBurnA = Math.max(burnA["1h"], burnA["6h"], burnA["24h"], burnA["3d"]);
        const maxBurnB = Math.max(burnB["1h"], burnB["6h"], burnB["24h"], burnB["3d"]);
        return maxBurnB - maxBurnA; // Descending (worst first)
      }
      
      // Sort by name
      return a.name.localeCompare(b.name);
    });
    
    return slos;
  }, [journey.slos, showOnlyIssues, sortBy, sloStatuses, seriesData]);

  // Calculate journey-level summary stats
  const journeySummary = useMemo(() => {
    let meeting = 0, atRisk = 0, breaching = 0;
    let totalErrorBudgetRemaining = 0;
    let maxBurnRate = 0;
    
    filteredSLOs.forEach((slo: SLO) => {
      const status = sloStatuses.get(slo.id);
      if (status) {
        if (status.status === "ok") meeting++;
        else if (status.status === "warn") atRisk++;
        else breaching++;
        
        totalErrorBudgetRemaining += status.errorBudget.remainingPercent;
        
        // Get max burn rate for this SLO
        const primarySLI = slo.indicators[0];
        if (primarySLI) {
          const data = seriesData[primarySLI.id] || [];
          const burnRates = calculateBurnRates(data, primarySLI, slo.objectivePercent);
          const sloMaxBurn = Math.max(burnRates["1h"], burnRates["6h"], burnRates["24h"], burnRates["3d"]);
          maxBurnRate = Math.max(maxBurnRate, sloMaxBurn);
        }
      }
    });
    
    const total = filteredSLOs.length;
    const avgErrorBudgetRemaining = total > 0 ? totalErrorBudgetRemaining / total : 100;
    const healthPercent = total > 0 ? (meeting / total) * 100 : 100;
    
    return {
      total,
      meeting,
      atRisk,
      breaching,
      healthPercent,
      avgErrorBudgetRemaining,
      maxBurnRate
    };
  }, [filteredSLOs, sloStatuses, seriesData]);

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

  return (
    <div id={`journey-${journey.id}`} className="space-y-4">
      {/* Sort & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 min-h-[44px]"
          >
            <option value="status">Status (worst first)</option>
            <option value="errorBudget">Error Budget (least remaining)</option>
            <option value="burnRate">Burn Rate (highest first)</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
        
        <button
          onClick={() => setShowOnlyIssues(!showOnlyIssues)}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors min-h-[44px] ${
            showOnlyIssues
              ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
              : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'
          }`}
        >
          {showOnlyIssues ? '✓ ' : ''}Show only issues
        </button>
      </div>

      {/* Journey Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Health */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Overall Health</div>
          <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {journeySummary.healthPercent.toFixed(0)}%
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {journeySummary.meeting} of {journeySummary.total} meeting targets
          </div>
        </div>

        {/* Error Budget */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Avg Error Budget</div>
          <div className={`text-3xl font-bold ${
            journeySummary.avgErrorBudgetRemaining >= 50 
              ? 'text-green-600 dark:text-green-500' 
              : journeySummary.avgErrorBudgetRemaining >= 20
              ? 'text-amber-600 dark:text-amber-500'
              : 'text-red-600 dark:text-red-500'
          }`}>
            {journeySummary.avgErrorBudgetRemaining.toFixed(1)}%
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            Remaining across all SLOs
          </div>
        </div>

        {/* At Risk Count */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Issues</div>
          <div className="flex items-baseline gap-2">
            {journeySummary.breaching > 0 && (
              <div className="text-3xl font-bold text-red-600 dark:text-red-500">
                {journeySummary.breaching}
              </div>
            )}
            {journeySummary.atRisk > 0 && (
              <div className={`${journeySummary.breaching > 0 ? 'text-xl' : 'text-3xl'} font-bold text-amber-600 dark:text-amber-500`}>
                {journeySummary.atRisk}
              </div>
            )}
            {journeySummary.breaching === 0 && journeySummary.atRisk === 0 && (
              <div className="text-3xl font-bold text-green-600 dark:text-green-500">0</div>
            )}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {journeySummary.breaching > 0 && `${journeySummary.breaching} breaching`}
            {journeySummary.breaching > 0 && journeySummary.atRisk > 0 && ' • '}
            {journeySummary.atRisk > 0 && `${journeySummary.atRisk} at risk`}
            {journeySummary.breaching === 0 && journeySummary.atRisk === 0 && 'All SLOs healthy'}
          </div>
        </div>

        {/* Max Burn Rate */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Worst Burn Rate</div>
          <div className={`text-3xl font-bold ${
            journeySummary.maxBurnRate <= 1 
              ? 'text-green-600 dark:text-green-500'
              : journeySummary.maxBurnRate <= 2
              ? 'text-amber-600 dark:text-amber-500'
              : 'text-red-600 dark:text-red-500'
          }`}>
            {journeySummary.maxBurnRate.toFixed(1)}x
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
            {journeySummary.maxBurnRate <= 1 ? 'Normal consumption' : journeySummary.maxBurnRate <= 2 ? 'Elevated consumption' : 'Critical consumption'}
          </div>
        </div>
      </div>

      {/* Tier Sections */}
      {filteredSLOs.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="text-4xl mb-4">🔍</div>
          <p className="text-neutral-600 dark:text-neutral-400">
            {showOnlyIssues ? 'No issues found - all SLOs are healthy!' : 'No SLOs to display'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
      {(["tier-0", "tier-1", "tier-2"] as const).map(tier => {
            const slos = slosByTier[tier];
            if (slos.length === 0) return null;
            
            const tierKey = `${journey.id}-${tier}`;
            const tierLabel = tier === "tier-0" ? "Critical Services (Tier-0)" : tier === "tier-1" ? "Important Services (Tier-1)" : "Standard Services (Tier-2)";
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
                        {tierLabel}
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
                        darkMode={darkMode}
                        timeRangeDays={timeRangeDays}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  darkMode?: boolean;
}

function SLOCard({ slo, seriesData, status, isExpanded, onToggle, darkMode = false, timeRangeDays = 28 }: SLOCardProps & { timeRangeDays?: number }) {
  const primarySLI = slo.indicators[0];
  const data = seriesData[primarySLI?.id] || [];

  const windowData = sliceTimeWindow(data, timeRangeDays * 24 * 60 * 60 * 1000);
  const chartWindowData = sliceTimeWindow(data, 7 * 24 * 60 * 60 * 1000); // 7 days for charts (hourly granularity)
  const currentValue = getCurrentSLIValue(primarySLI, windowData);
  const meetsObjective = status?.meetsObjective ?? isSLIMeetingObjective(primarySLI, currentValue);
  
  // Convert to performance percentage for error budget calculation
  const performancePercent = primarySLI.type === "latency"
    ? getLatencyCompliancePercent(primarySLI, windowData) // % of time meeting target
    : currentValue; // Already a percentage for availability/quality/etc
    
  // Always calculate full error budget to have all properties available
  const errorBudget = calculateErrorBudget(performancePercent, slo.objectivePercent);
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

  // Calculate trend: compare last 7 days vs previous 7 days
  const getTrendIndicator = () => {
    if (!primarySLI || data.length < 14) return null;
    
    // Use fixed demo data end date (display through Oct 23)
    const demoEndDate = new Date('2025-10-23T23:59:59Z').getTime();
    const last7Days = sliceTimeWindow(data, 7 * 24 * 60 * 60 * 1000);
    const previous7Days = data.filter(point => {
      const pointTime = new Date(point.t).getTime();
      const sevenDaysAgo = demoEndDate - (7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = demoEndDate - (14 * 24 * 60 * 60 * 1000);
      return pointTime >= fourteenDaysAgo && pointTime < sevenDaysAgo;
    });
    
    if (previous7Days.length === 0) return null;
    
    const recentValue = getCurrentSLIValue(primarySLI, last7Days);
    const previousValue = getCurrentSLIValue(primarySLI, previous7Days);
    
    // Determine if improvement (depends on objective direction)
    let isImproving = false;
    if (primarySLI.objectiveDirection === "gte") {
      isImproving = recentValue > previousValue;
    } else {
      isImproving = recentValue < previousValue;
    }
    
    const diff = Math.abs(recentValue - previousValue);
    const percentDiff = previousValue !== 0 ? (diff / previousValue) * 100 : 0;
    
    // Only show if change is meaningful (>1% relative change)
    if (percentDiff < 1) return null;
    
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
        isImproving 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      }`} title={`${percentDiff.toFixed(1)}% ${isImproving ? 'improvement' : 'degradation'} vs last week`}>
        {isImproving ? '↗ Improving' : '↘ Worsening'}
      </span>
    );
  };


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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{slo.name}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTierColor(slo.criticality)}`}>
                {slo.criticality === "tier-0" ? "Critical" : slo.criticality === "tier-1" ? "Important" : "Standard"}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              {getTrendIndicator()}
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

          {/* 3-Chart Layout - Hidden on mobile, shown on tablet+ */}
          <div className="hidden sm:block space-y-4">
            {/* 1. Service Level Indicator Chart */}
            <SLIChart sli={primarySLI} dataPoints={chartWindowData} darkMode={darkMode} />

            {/* 2. Reliability Burn Down Chart */}
            <ReliabilityBurnDownChart 
              sli={primarySLI} 
              dataPoints={chartWindowData} 
              objectivePercent={slo.objectivePercent} 
              darkMode={darkMode} 
            />

            {/* 3. Error Budget Burn Rate Chart */}
            <BurnRateChart 
              sli={primarySLI} 
              dataPoints={chartWindowData} 
              objectivePercent={slo.objectivePercent} 
              darkMode={darkMode} 
            />
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

          {/* Incident Timeline - Aligned with chart */}
          <div className="overflow-x-auto overflow-y-hidden">
            <div className="ml-[120px] mr-[40px]">
              <IncidentTimeline data={data} sli={primarySLI} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Quick Actions</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert('This would create an incident for: ' + slo.name);
                }}
                className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors min-h-[44px] flex items-center gap-1"
              >
                🚨 Create Incident
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert('This would open monitoring dashboard for: ' + slo.name);
                }}
                className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors min-h-[44px] flex items-center gap-1"
              >
                📊 View Metrics
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert('This would notify the team: ' + slo.owner);
                }}
                className="px-3 py-1.5 text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors min-h-[44px] flex items-center gap-1"
              >
                📢 Notify Team
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = window.location.origin + window.location.pathname + '?slo=' + slo.id;
                  navigator.clipboard.writeText(url);
                  alert('Link copied to clipboard!');
                }}
                className="px-3 py-1.5 text-sm bg-neutral-50 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors min-h-[44px] flex items-center gap-1"
              >
                🔗 Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
