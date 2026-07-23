import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { getReputationTier } from "@/lib/reputation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileChip } from "@/components/profile-chip";
import {
  PARTY_STATUS_BADGE_VARIANT,
  PARTY_STATUS_LABEL,
  formatScheduledAt,
} from "@/domains/party/constants";
import { ApplyButton } from "@/domains/party/components/apply-button";
import { LeaveOrCancelButton } from "@/domains/party/components/leave-or-cancel-button";
import { HostApplicants, type Applicant } from "@/domains/party/components/host-applicants";
import { PartyStatusControls } from "@/domains/party/components/party-status-controls";
import { MannerEvaluationPanel, type Reviewee } from "@/domains/party/components/manner-evaluation-panel";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, profile } = await getCurrentProfile();

  const { data: party } = await supabase
    .from("parties")
    .select(
      "id, title, description, max_members, current_members, status, scheduled_at, host_id, game:games(name), host:profiles!parties_host_id_fkey(id, nickname, avatar_url)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!party) notFound();

  const isHost = user?.id === party.host_id;

  const { data: acceptedRows } = await supabase
    .from("party_members")
    .select("user_id, profile:profiles(id, nickname, avatar_url)")
    .eq("party_id", id)
    .eq("status", "accepted");

  const accepted = acceptedRows ?? [];
  const acceptedWithTier = await Promise.all(
    accepted.map(async (row) => {
      const p = row.profile as unknown as { id: string; nickname: string; avatar_url: string | null };
      return { ...p, tier: await getReputationTier(supabase, p.id) };
    })
  );

  const hostTier = await getReputationTier(supabase, party.host_id);

  let myMembership: { id: string; status: string } | null = null;
  let blockedWithHost = false;
  let hasOtherPendingApplication = false;
  if (user && !isHost) {
    const { data } = await supabase
      .from("party_members")
      .select("id, status")
      .eq("party_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    myMembership = data;

    const { data: blocked } = await supabase.rpc("blocked_between", {
      a: user.id,
      b: party.host_id,
    });
    blockedWithHost = !!blocked;

    const { data: otherPending } = await supabase
      .from("party_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .neq("party_id", id)
      .limit(1);
    hasOtherPendingApplication = (otherPending ?? []).length > 0;
  }

  let applicants: Applicant[] = [];
  if (isHost) {
    const { data: pendingRows } = await supabase
      .from("party_members")
      .select("id, user_id, profile:profiles(id, nickname, avatar_url)")
      .eq("party_id", id)
      .eq("status", "pending");

    applicants = await Promise.all(
      (pendingRows ?? []).map(async (row) => {
        const p = row.profile as unknown as { id: string; nickname: string; avatar_url: string | null };
        return {
          memberRowId: row.id,
          userId: p.id,
          nickname: p.nickname,
          avatarUrl: p.avatar_url,
          tier: await getReputationTier(supabase, p.id),
        };
      })
    );
  }

  let reviewees: Reviewee[] = [];
  const iAmAcceptedMember = isHost || myMembership?.status === "accepted";
  if (party.status === "completed" && user && iAmAcceptedMember) {
    const { data: myEvaluations } = await supabase
      .from("manner_evaluations")
      .select("reviewee_id")
      .eq("party_id", id)
      .eq("reviewer_id", user.id);

    const evaluatedIds = new Set((myEvaluations ?? []).map((e) => e.reviewee_id));

    reviewees = acceptedWithTier
      .filter((m) => m.id !== user.id)
      .map((m) => ({
        userId: m.id,
        nickname: m.nickname,
        avatarUrl: m.avatar_url,
        alreadyEvaluated: evaluatedIds.has(m.id),
      }));
  }

  const host = party.host as unknown as { id: string; nickname: string; avatar_url: string | null };
  const game = party.game as unknown as { name: string } | null;

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{game?.name ?? "기타"}</p>
          <Badge variant={PARTY_STATUS_BADGE_VARIANT[party.status]}>
            {PARTY_STATUS_LABEL[party.status]}
          </Badge>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{party.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatScheduledAt(party.scheduled_at)} · {party.current_members}/{party.max_members}명
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">호스트</p>
        <ProfileChip
          userId={host.id}
          nickname={host.nickname}
          avatarUrl={host.avatar_url}
          tier={hostTier}
        />
      </div>

      {party.description && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">설명</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{party.description}</p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          참가 멤버 ({acceptedWithTier.length}명)
        </p>
        <div className="flex flex-wrap gap-2">
          {acceptedWithTier.map((member) => (
            <ProfileChip
              key={member.id}
              userId={member.id}
              nickname={member.nickname}
              avatarUrl={member.avatar_url}
              tier={member.tier}
            />
          ))}
        </div>
      </div>

      {!user && (
        <Button nativeButton={false} render={<Link href="/login" />}>
          로그인하고 참가 신청하기
        </Button>
      )}

      {user && !profile && (
        <Button nativeButton={false} render={<Link href="/onboarding" />}>
          프로필을 완성하고 참가 신청하기
        </Button>
      )}

      {user && profile && !isHost && party.status === "recruiting" && blockedWithHost && (
        <p className="text-sm text-muted-foreground">이 파티에는 참가할 수 없어요.</p>
      )}

      {user && profile && !isHost && party.status === "recruiting" && !blockedWithHost && (
        <>
          {!myMembership && (
            <ApplyButton
              partyId={id}
              userId={user.id}
              hasOtherPendingApplication={hasOtherPendingApplication}
            />
          )}
          {myMembership?.status === "pending" && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">신청 완료. 호스트의 수락을 기다리고 있어요.</p>
              <LeaveOrCancelButton memberRowId={myMembership.id} label="신청 취소" />
            </div>
          )}
          {myMembership?.status === "rejected" && (
            <p className="text-sm text-muted-foreground">아쉽지만 이번 파티는 참가가 어려워요.</p>
          )}
          {myMembership?.status === "withdrawn" && (
            <p className="text-sm text-muted-foreground">
              다른 파티에 참가가 확정되어 이 신청은 자동으로 취소됐어요.
            </p>
          )}
        </>
      )}

      {user && myMembership?.status === "accepted" && party.status !== "completed" && (
        <LeaveOrCancelButton memberRowId={myMembership.id} label="파티 나가기" />
      )}

      {isHost && (party.status === "recruiting" || party.status === "in_progress") && (
        <div className="space-y-4 rounded-lg border p-4">
          <PartyStatusControls partyId={id} status={party.status} />
          {party.status === "recruiting" && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">신청자</p>
              <HostApplicants applicants={applicants} />
            </div>
          )}
        </div>
      )}

      {reviewees.length > 0 && user && (
        <MannerEvaluationPanel partyId={id} reviewerId={user.id} reviewees={reviewees} />
      )}
    </div>
  );
}
