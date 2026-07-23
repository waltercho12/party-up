"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { ReportStatus } from "@/lib/supabase/types";

export function ReportStatusControls({ id, status }: { id: string; status: ReportStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(next: ReportStatus) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").update({ status: next }).eq("id", id);
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
      <Button size="sm" disabled={loading} onClick={() => updateStatus("reviewed")}>
        확인 완료
      </Button>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => updateStatus("dismissed")}>
        기각
      </Button>
    </div>
  );
}
