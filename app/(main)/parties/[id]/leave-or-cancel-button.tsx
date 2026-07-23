"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LeaveOrCancelButton({
  memberRowId,
  label,
}: {
  memberRowId: string;
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("party_members")
      .update({ status: "left" })
      .eq("id", memberRowId);
    setLoading(false);

    if (error) {
      toast.error("처리에 실패했어요: " + error.message);
      return;
    }

    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={loading} className="w-full">
      {label}
    </Button>
  );
}
