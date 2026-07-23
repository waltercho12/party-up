"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_REASONS } from "@/lib/supabase/types";

export function ReportDialog({ targetUserId }: { targetUserId: string }) {
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState("");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!reasonCode) {
      toast.error("신고 사유를 선택해주세요.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: targetUserId,
      reason_code: reasonCode,
      evidence_text: evidence.trim() || null,
    });
    setLoading(false);

    if (error) {
      toast.error("신고 접수에 실패했어요: " + error.message);
      return;
    }

    toast.success("신고가 접수됐어요. 검토 후 조치할게요.");
    setOpen(false);
    setReasonCode("");
    setEvidence("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>신고하기</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>신고하기</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>사유</Label>
            <Select
              value={reasonCode}
              onValueChange={(value) => setReasonCode(value ?? "")}
              items={Object.fromEntries(REPORT_REASONS.map((reason) => [reason.code, reason.label]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="사유를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>증거 / 상황 설명</Label>
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="어떤 상황이었는지 구체적으로 적어주세요."
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            신고 접수
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
