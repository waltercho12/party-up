import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReputationTier } from "@/lib/supabase/types";

export async function getReputationTier(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ReputationTier> {
  const { data } = await supabase.rpc("get_reputation_tier", { target_user_id: userId });
  return (data as ReputationTier) ?? "traveler";
}

export interface ReputationSummary {
  tier: ReputationTier;
  completedParties: number;
  // null until the profile owner has 10+ evaluations (or unless you're
  // viewing your own profile) — see get_reputation_summary().
  replayRatioPct: number | null;
  punctualPct: number | null;
  atmospherePct: number | null;
  stayedFullPct: number | null;
  statsVisible: boolean;
  totalEvaluations: number;
}

export async function getReputationSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ReputationSummary> {
  const { data } = await supabase.rpc("get_reputation_summary", { target_user_id: userId });
  const row = data?.[0];
  return {
    tier: row?.tier ?? "traveler",
    completedParties: row?.completed_parties ?? 0,
    replayRatioPct: row?.replay_ratio_pct ?? null,
    punctualPct: row?.punctual_pct ?? null,
    atmospherePct: row?.atmosphere_pct ?? null,
    stayedFullPct: row?.stayed_full_pct ?? null,
    statsVisible: row?.stats_visible ?? false,
    totalEvaluations: row?.total_evaluations ?? 0,
  };
}

// Presence-only badges — never a percentage, never a count. See
// get_trust_badges() for the (hidden) threshold and the same
// self-or-10-evaluations visibility gate used by getReputationSummary.
export interface TrustBadges {
  replayRecommended: boolean;
  punctual: boolean;
  easyCommunication: boolean;
  stayedFull: boolean;
  beginnerFriendly: boolean;
  visible: boolean;
}

export async function getTrustBadges(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TrustBadges> {
  const { data } = await supabase.rpc("get_trust_badges", { target_user_id: userId });
  const row = data?.[0];
  return {
    replayRecommended: row?.replay_recommended ?? false,
    punctual: row?.punctual ?? false,
    easyCommunication: row?.easy_communication ?? false,
    stayedFull: row?.stayed_full ?? false,
    beginnerFriendly: row?.beginner_friendly ?? false,
    visible: row?.visible ?? false,
  };
}

export interface PlayRecord {
  completedTotal: number;
  completedLast30d: number;
  avgPartySize: number;
}

export async function getPlayRecord(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PlayRecord> {
  const { data } = await supabase.rpc("get_play_record", { target_user_id: userId });
  const row = data?.[0];
  return {
    completedTotal: row?.completed_total ?? 0,
    completedLast30d: row?.completed_last_30d ?? 0,
    avgPartySize: row?.avg_party_size ?? 0,
  };
}

export interface RecentActivityItem {
  partyId: string;
  title: string;
  gameName: string;
  completedAt: string | null;
}

export async function getRecentActivity(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 5
): Promise<RecentActivityItem[]> {
  const { data } = await supabase.rpc("get_recent_activity", {
    target_user_id: userId,
    limit_count: limit,
  });
  return (data ?? []).map((row) => ({
    partyId: row.party_id,
    title: row.title,
    gameName: row.game_name,
    completedAt: row.completed_at,
  }));
}
