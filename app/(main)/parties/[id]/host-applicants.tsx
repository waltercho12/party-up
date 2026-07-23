"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ProfileChip } from "@/components/profile-chip";
import type { ReputationTier } from "@/lib/supabase/types";

export interface Applicant {
  memberRowId: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  tier: ReputationTier;
}

export function HostApplicants({ applicants }: { applicants: Applicant[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function respond(memberRowId: string, status: "accepted" | "rejected") {
    setLoadingId(memberRowId);
    const supabase = createClient();
    const { error } = await supabase
      .from("party_members")
      .update({ status })
      .eq("id", memberRowId);
    setLoadingId(null);

    if (error) {
      toast.error("처리에 실패했어요: " + error.message);
      return;
    }

    toast.success(status === "accepted" ? "수락했어요." : "거절했어요.");
    router.refresh();
  }

  if (applicants.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 신청자가 없어요.</p>;
  }

  return (
    <div className="space-y-2">
      {applicants.map((applicant) => (
        <div key={applicant.memberRowId} className="flex items-center justify-between gap-3">
          <ProfileChip
            userId={applicant.userId}
            nickname={applicant.nickname}
            avatarUrl={applicant.avatarUrl}
            tier={applicant.tier}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={loadingId === applicant.memberRowId}
              onClick={() => respond(applicant.memberRowId, "accepted")}
            >
              수락
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingId === applicant.memberRowId}
              onClick={() => respond(applicant.memberRowId, "rejected")}
            >
              거절
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
