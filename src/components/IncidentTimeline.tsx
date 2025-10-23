import { useMemo } from "react";
import type { DataPoint } from "../lib/sloMath";
import { detectIncidents } from "../lib/sloMath";
import type { SLI } from "../models/slo";

interface IncidentTimelineProps {
  data: DataPoint[];
  sli: SLI;
}

export default function IncidentTimeline({ data, sli }: IncidentTimelineProps) {
  const incidents = useMemo(() => detectIncidents(data, sli), [data, sli]);

  // Show last 7 days
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentIncidents = incidents.filter(inc => 
    new Date(inc.timestamp) >= sevenDaysAgo
  );

  if (recentIncidents.length === 0) {
    return (
      <div className="w-full p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <div className="text-sm text-green-700 dark:text-green-400">
          ✓ No incidents detected in the last 7 days
        </div>
      </div>
    );
  }

  // Calculate position of each incident
  const getPosition = (timestamp: string): number => {
    const incidentTime = new Date(timestamp).getTime();
    const range = now.getTime() - sevenDaysAgo.getTime();
    const offset = incidentTime - sevenDaysAgo.getTime();
    return (offset / range) * 100;
  };

  return (
    <div className="w-full">
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Incidents (Last 7 Days) - {recentIncidents.length} detected
      </div>
      <div className="relative w-full h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        {/* Timeline bar */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-neutral-300 dark:bg-neutral-600 transform -translate-y-1/2" />
        
        {/* Incident markers */}
        {recentIncidents.map((incident, idx) => {
          const position = getPosition(incident.timestamp);
          return (
            <div
              key={idx}
              className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 group"
              style={{ left: `${position}%` }}
            >
              <div className="w-3 h-3 bg-red-500 dark:bg-red-600 rounded-full cursor-pointer hover:scale-125 transition-transform" />
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-neutral-900 dark:bg-neutral-800 text-white dark:text-neutral-100 text-xs rounded px-2 py-1 whitespace-nowrap border border-neutral-700">
                  <div className="font-medium">
                    {new Date(incident.timestamp).toLocaleString()}
                  </div>
                  <div className="text-neutral-300 dark:text-neutral-400 max-w-xs">{incident.reason}</div>
                </div>
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900 dark:border-t-neutral-800" />
              </div>
            </div>
          );
        })}

        {/* Timeline labels */}
        <div className="absolute top-full left-0 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          7d ago
        </div>
        <div className="absolute top-full right-0 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Now
        </div>
      </div>
    </div>
  );
}
