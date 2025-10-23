import { create } from "zustand";
import type { ExperienceRollup } from "../models/slo";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type State = {
  seed: { experiences: ExperienceRollup[] };
  series: Record<string, { t: string; good: number; bad: number; value?: number }[]>;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
};

export const useData = create<State>((set) => ({
  seed: { experiences: [] },
  series: {},
  loading: false,
  error: null,
  
  fetchData: async () => {
    set({ loading: true, error: null });
    
    try {
      // Fetch both seed and series data in parallel
      // Use hourly aggregation for good balance between accuracy and performance
      // Hourly gives us enough granularity for accurate error budget calculations
      // while being much faster than raw 5-minute data
      const [seedResponse, seriesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/seed`),
        fetch(`${API_BASE_URL}/api/series?days=28&aggregate=hourly`)
      ]);
      
      if (!seedResponse.ok || !seriesResponse.ok) {
        throw new Error('Failed to fetch data from API');
      }
      
      const seed = await seedResponse.json();
      const series = await seriesResponse.json();
      
      set({ 
        seed: seed as { experiences: ExperienceRollup[] },
        series: series as Record<string, { t: string; good: number; bad: number; value?: number }[]>,
        loading: false 
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false 
      });
    }
  }
}));
