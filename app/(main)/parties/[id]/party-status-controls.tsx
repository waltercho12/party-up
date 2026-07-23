"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { PartyStatus } from "@/lib/supabase/types";

export function PartyStatusControls({
  partyId,
  status,
}: {
  partyId: string;
  status: PartyStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(next: PartyStatus) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("parties").update({ status: next }).eq("id", partyId);
    setLoading(false);

    if (error) {
      toast.error("상태 변경에 실패했어요: " + error.message);
      return;
    }

    router.refresh();
  }

  if (status === "recruiting") {
    return (
      <div className="flex gap-2">
        <Button className="flex-1" disabled={loading} onClick={() => updateStatus("in_progress")}>
          모집 마감하고 시작하기
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => updateStatus("cancelled")}
        >
          파티 취소
        </Button>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="flex gap-2">
        <Button className="flex-1" disabled={loading} onClick={() => updateStatus("completed")}>
          파티 종료하기
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => updateStatus("cancelled")}
        >
          파티 취소
        </Button>
      </div>
    );
  }

  return null;
}
