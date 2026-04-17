import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase.functions.invoke('firecrawl-osint');
      if (error) throw error;

      setState({
        news: data?.news || [],
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
