import { useState, useEffect, useCallback } from 'react';

export interface OsintNewsItem {
  title: string;
  source: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: string;
  url: string;
}

interface OsintFeedState {
  news: OsintNewsItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

export function useOsintFeed(refreshInterval = 300000) {
  const [state, setState] = useState<OsintFeedState>({
    news: [],
    isLoading: false,
    error: null,
    lastUpdate: null,
  });

  const fetchNews = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/firecrawl-osint`,
        {
          headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      setState({
        news: data.news || [],
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchNews, refreshInterval]);

  return state;
}
