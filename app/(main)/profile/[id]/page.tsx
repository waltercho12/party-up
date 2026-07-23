import { notFound } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import {
  getReputationSummary,
  getTrustBadges,
  getPlayRecord,
  getRecentActivity,
  type TrustBadges,
} from "@/lib/reputation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReputationBadge } from "@/components/reputation-badge";
import { BlockButton } from "@/components/block-button";
import { ReportDialog } from "@/components/report-dialog";
import {
  REPUTATION_TIER_LABEL,
  REPUTATION_TIER_MOTTO,
  REPUTATION_TIER_DESCRIPTION,
  type ReputationTier,
} from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const TIER_ORDER: ReputationTier[] = ["traveler", "mate", "friend", "guide", "companion"];

const TRUST_ITEMS: { key: keyof Omit<TrustBadges, "visible">; emoji: string; label: string }[] = [
  { key: "replayRecommended", emoji: "😊", label: "다시 함께 플레이하고 싶어요" },
  { key: "punctual", emoji: "⏰", label: "시간 약속을 잘 지켜요" },
  { key: "easyCommunication", emoji: "💬", label: "소통이 편해요" },
  { key: "stayedFull", emoji: "🎮", label: "끝까지 함께 플레이했어요" },
  { key: "beginnerFriendly", emoji: "🌱", label: "초보를 배려해요" },
];

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user: viewer } = await getCurrentProfile();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url, bio")
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = viewer?.id === id;

  const [reputation, trustBadges, playRecord, recentActivity, gameHistoryRes, blockRow] =
    await Promise.all([
      getReputationSummary(supabase, id),
      getTrustBadges(supabase, id),
      getPlayRecord(supabase, id),
      getRecentActivity(supabase, id, 5),
      supabase.rpc("get_game_history", { target_user_id: id }),
      viewer && viewer.id !== id
        ? supabase
            .from("blocks")
            .select("id")
            .eq("blocker_id", viewer.id)
            .eq("blocked_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const gameHistory = gameHistoryRes.data ?? [];
  const isBlocked = !!blockRow.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* 1. Profile basics */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center sm:flex-row sm:items-start sm:text-left">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.nickname} />
            <AvatarFallback className="text-2xl">{profile.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-xl font-semibold">{profile.nickname}</h1>
              <ReputationBadge tier={reputation.tier} />
            </div>
            {profile.bio && (
              <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}
            {viewer && viewer.id !== id && (
              <div className="flex justify-center gap-2 pt-1 sm:justify-start">
                <BlockButton targetUserId={id} initiallyBlocked={isBlocked} />
                <ReportDialog targetUserId={id} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Trust indicators — the most important section */}
      <Card>
        <CardHeader>
          <CardTitle>함께한 사람들이 이렇게 평가했어요</CardTitle>
        </CardHeader>
        <CardContent>
          {trustBadges.visible ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TRUST_ITEMS.map((item) => {
                const earned = trustBadges[item.key];
                return (
                  <li
                    key={item.key}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      earned
                        ? "border-primary/30 bg-primary/5 font-medium"
                        : "text-muted-foreground/60"
                    )}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              아직 평가가 충분히 쌓이지 않아 공개되지 않았어요.
            </p>
          )}
          {isOwner && reputation.totalEvaluations < 10 && (
            <p className="mt-3 text-xs text-muted-foreground">
              지금은 나만 볼 수 있어요. 평가를 {10 - reputation.totalEvaluations}개 더 받으면 다른
              사람에게도 공개돼요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3. Play record */}
      <Card>
        <CardHeader>
          <CardTitle>플레이 기록</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{playRecord.completedTotal}회</p>
            <p className="mt-1 text-sm font-medium">완료한 파티</p>
            <p className="mt-1 text-xs text-muted-foreground">
              다양한 사람들과 함께 플레이한 기록입니다.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{playRecord.completedLast30d}회</p>
            <p className="mt-1 text-sm font-medium">최근 30일</p>
            <p className="mt-1 text-xs text-muted-foreground">최근에도 꾸준히 활동 중입니다.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{playRecord.avgPartySize}명</p>
            <p className="mt-1 text-sm font-medium">평균 파티 인원</p>
            <p className="mt-1 text-xs text-muted-foreground">
              혼자보다 함께 플레이하는 것을 좋아합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Main games */}
      <Card>
        <CardHeader>
          <CardTitle>주로 플레이하는 게임</CardTitle>
        </CardHeader>
        <CardContent>
          {gameHistory.length > 0 ? (
            <ul className="divide-y">
              {gameHistory.map((g) => (
                <li key={g.game_name} className="flex items-center gap-3 py-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Gamepad2 className="size-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{g.game_name}</span>
                  <span className="text-sm text-muted-foreground">{g.play_count}회</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">아직 함께한 파티 기록이 없어요.</p>
          )}
        </CardContent>
      </Card>

      {/* 5. Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>최근 활동</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <ul className="space-y-2">
              {recentActivity.map((a) => (
                <li
                  key={a.partyId}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.gameName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">최근 완료한 파티가 없어요.</p>
          )}
        </CardContent>
      </Card>

      {/* 6. Reputation tier card */}
      <Card>
        <CardContent className="space-y-6 pt-2">
          <div className="text-center">
            <p className="text-2xl font-bold">{REPUTATION_TIER_LABEL[reputation.tier]}</p>
            <p className="mt-1 text-muted-foreground">&ldquo;{REPUTATION_TIER_MOTTO[reputation.tier]}&rdquo;</p>
          </div>
          <ul className="space-y-2">
            {TIER_ORDER.map((t) => (
              <li
                key={t}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  t === reputation.tier && "border-primary/40 bg-primary/5"
                )}
              >
                <ReputationBadge tier={t} />
                <span className="text-sm text-muted-foreground">
                  {REPUTATION_TIER_DESCRIPTION[t]}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
