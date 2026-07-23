import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Button } from "@/components/ui/button";
import { PartyCard, type PartyCardData } from "@/components/party-card";
import { PartyFilters } from "./party-filters";
import type { PartyStatus } from "@/lib/supabase/types";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { user } = await getCurrentProfile();

  const { data: games } = await supabase
    .from("games")
    .select("id, name")
    .order("name");

  let query = supabase
    .from("parties")
    .select(
      "id, title, description, max_members, current_members, status, scheduled_at, host_id, game:games(name), host:profiles!parties_host_id_fkey(nickname)"
    )
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status as PartyStatus);
  } else {
    query = query.in("status", ["recruiting", "in_progress"]);
  }

  if (params.game) {
    query = query.eq("game_id", params.game);
  }

  const { data: rows } = await query;

  let blockedHostIds = new Set<string>();
  let myInvolvedPartyIds = new Set<string>();
  if (user) {
    const [{ data: myBlocks }, { data: myMemberships }] = await Promise.all([
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
      supabase
        .from("party_members")
        .select("party_id")
        .eq("user_id", user.id)
        .in("status", ["pending", "accepted"]),
    ]);
    blockedHostIds = new Set((myBlocks ?? []).map((b) => b.blocked_id));
    myInvolvedPartyIds = new Set((myMemberships ?? []).map((m) => m.party_id));
  }

  const parties = (rows ?? []).filter((p) => !blockedHostIds.has(p.host_id));

  // Recruiting counts (overall + per-game) for the explore header and the
  // game filter dropdown. "모집중" specifically, not "진행중" — matches the
  // label users see elsewhere in the UI.
  const { data: recruitingRows } = await supabase
    .from("parties")
    .select("game_id")
    .eq("status", "recruiting");

  const gameCounts: Record<string, number> = {};
  for (const row of recruitingRows ?? []) {
    gameCounts[row.game_id] = (gameCounts[row.game_id] ?? 0) + 1;
  }
  const totalRecruiting = recruitingRows?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">파티 탐색</h1>
          <p className="text-sm text-muted-foreground">
            믿고 함께 게임할 사람을 찾아보세요. 현재 모집중인 파티 {totalRecruiting}개
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/parties/new" />}>
          모집글 작성
        </Button>
      </div>

      <PartyFilters games={games ?? []} gameCounts={gameCounts} />

      {parties.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(parties as unknown as PartyCardData[]).map((party) => (
            <PartyCard key={party.id} party={party} isMine={myInvolvedPartyIds.has(party.id) || party.host_id === user?.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          아직 모집글이 없어요. 첫 파티를 만들어보세요.
        </div>
      )}
    </div>
  );
}
