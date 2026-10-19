import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

export const firecrawlApi = {
  async scrape(url: string, options?: Record<string, unknown>): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },

  async search(query: string, options?: Record<string, unknown>): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-search', {
      body: { query, options },
    });
    if (error) return { success: false, error: error.message };
    return data;
  },
};
