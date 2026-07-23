"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function BlockButton({
  targetUserId,
  initiallyBlocked,
}: {
  targetUserId: string;
  initiallyBlocked: boolean;
}) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    if (blocked) {
      const { error } = await supabase
        .from("blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetUserId);
      setLoading(false);
      if (error) {
        toast.error("차단 해제에 실패했어요: " + error.message);
        return;
      }
      setBlocked(false);
      toast.success("차단을 해제했어요.");
    } else {
      const { error } = await supabase
        .from("blocks")
        .insert({ blocker_id: user.id, blocked_id: targetUserId });
      setLoading(false);
      if (error) {
        toast.error("차단에 실패했어요: " + error.message);
        return;
      }
      setBlocked(true);
      toast.success("차단했어요. 이제 서로의 파티에 참여할 수 없어요.");
    }
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={loading}>
      {blocked ? "차단 해제" : "차단하기"}
    </Button>
  );
}
