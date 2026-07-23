"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ApplyButton({
  partyId,
  userId,
  hasOtherPendingApplication,
}: {
  partyId: string;
  userId: string;
  hasOtherPendingApplication: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function submitApplication() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("party_members")
      .insert({ party_id: partyId, user_id: userId, status: "pending" });
    setLoading(false);

    if (error) {
      toast.error("참가 신청에 실패했어요: " + error.message);
      return;
    }

    toast.success("참가 신청을 보냈어요. 호스트의 수락을 기다려주세요.");
    setConfirmOpen(false);
    router.refresh();
  }

  function handleClick() {
    if (hasOtherPendingApplication) {
      setConfirmOpen(true);
      return;
    }
    submitApplication();
  }

  return (
    <>
      <Button onClick={handleClick} disabled={loading} className="w-full">
        참가 신청
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이미 다른 파티에 신청한 상태예요</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            이 파티에도 신청한 이후, 하나의 파티에 참석하게 될 시 나머지 파티 신청은 자동으로
            취소돼요.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              취소
            </Button>
            <Button onClick={submitApplication} disabled={loading}>
              신청하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
