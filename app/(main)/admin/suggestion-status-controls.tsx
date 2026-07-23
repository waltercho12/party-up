"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { SuggestionStatus } from "@/lib/supabase/types";

export function SuggestionStatusControls({
  id,
  status,
  submittedName,
}: {
  id: string;
  status: SuggestionStatus;
  submittedName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(next: SuggestionStatus) {
    setLoading(true);
    const supabase = createClient();

    if (next === "approved") {
      const { error: gameError } = await supabase
        .from("games")
        .insert({ name: submittedName, is_official: true });
      // A game with this name may already exist (duplicate suggestion) —
      // that's fine, the approval should still go through.
      if (gameError && gameError.code !== "23505") {
        setLoading(false);
        toast.error("게임 등록에 실패했어요: " + gameError.message);
        return;
      }
    }

    const { error } = await supabase
      .from("custom_game_suggestions")
      .update({ status: next })
      .eq("id", id);
    setLoading(false);

    if (error) {
      toast.error("처리에 실패했어요: " + error.message);
      return;
    }
    router.refresh();
  }

  if (status !== "pending") return null;

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={loading} onClick={() => updateStatus("approved")}>
        승인
      </Button>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => updateStatus("rejected")}>
        반려
      </Button>
    </div>
  );
}
