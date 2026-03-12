import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BaselineMetrics } from './types.js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  }
  client = createClient(url, key);
  return client;
}

const TABLE = 'weekly_baselines';

/**
 * Save baseline metrics for a given week.
 * Upserts on weekEnding to allow re-runs.
 */
export async function saveBaseline(metrics: BaselineMetrics): Promise<void> {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from(TABLE)
    .upsert(
      {
        week_ending: metrics.weekEnding,
        data: metrics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'week_ending' }
    );
  if (error) throw new Error(`Supabase save error: ${error.message}`);
}

/**
 * Load baseline metrics for a specific week.
 */
export async function loadBaseline(weekEnding: string): Promise<BaselineMetrics | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('data')
    .eq('week_ending', weekEnding)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Supabase load error: ${error.message}`);
  }
  return data?.data as BaselineMetrics ?? null;
}

/**
 * Load the previous week's baseline for WoW comparison.
 */
export async function loadPreviousBaseline(currentWeekEnding: string): Promise<BaselineMetrics | null> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('data')
    .lt('week_ending', currentWeekEnding)
    .order('week_ending', { ascending: false })
    .limit(1)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase load error: ${error.message}`);
  }
  return data?.data as BaselineMetrics ?? null;
}

/**
 * List all stored week labels.
 */
export async function listWeeks(): Promise<string[]> {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from(TABLE)
    .select('week_ending')
    .order('week_ending', { ascending: false });
  if (error) throw new Error(`Supabase list error: ${error.message}`);
  return (data ?? []).map((r: { week_ending: string }) => r.week_ending);
}

/**
 * SQL to create the baseline table — run once via Supabase dashboard or migration.
 */
export const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS weekly_baselines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  week_ending text UNIQUE NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_baselines_week ON weekly_baselines(week_ending);
`;
