"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SUPPORT_TICKET_STATUS_LABEL,
  type SupportTicketStatus,
} from "@/lib/supabase/types";

interface Reply {
  id: string;
  body: string;
  created_at: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminTicketActions({
  ticketId,
  status,
  assigneeId,
  internalNote,
  admins,
  replies,
}: {
  ticketId: string;
  status: string;
  assigneeId: string | null;
  internalNote: string | null;
  admins: { id: string; nickname: string }[];
  replies: Reply[];
}) {
  const router = useRouter();
  const [statusValue, setStatusValue] = useState(status);
  const [assignee, setAssignee] = useState(assigneeId ?? "unassigned");
  const [note, setNote] = useState(internalNote ?? "");
  const [replyBody, setReplyBody] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  async function updateStatus(next: string) {
    setStatusValue(next);
    setSavingStatus(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: next as SupportTicketStatus })
      .eq("id", ticketId);
    setSavingStatus(false);
    if (error) {
      toast.error("상태 변경에 실패했어요: " + error.message);
      return;
    }
    toast.success("상태를 변경했어요.");
    router.refresh();
  }

  async function updateAssignee(next: string) {
    setAssignee(next);
    setSavingAssignee(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({ assignee_id: next === "unassigned" ? null : next })
      .eq("id", ticketId);
    setSavingAssignee(false);
    if (error) {
      toast.error("담당자 지정에 실패했어요: " + error.message);
      return;
    }
    toast.success("담당자를 지정했어요.");
    router.refresh();
  }

  async function saveNote() {
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({ internal_note: note.trim() || null })
      .eq("id", ticketId);
    setSavingNote(false);
    if (error) {
      toast.error("메모 저장에 실패했어요: " + error.message);
      return;
    }
    toast.success("내부 메모를 저장했어요.");
  }

  async function submitReply() {
    if (!replyBody.trim()) {
      toast.error("답변 내용을 입력해주세요.");
      return;
    }
    setSendingReply(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSendingReply(false);
      return;
    }

    const { error } = await supabase.from("support_replies").insert({
      ticket_id: ticketId,
      author_id: user.id,
      body: replyBody.trim(),
    });

    if (error) {
      setSendingReply(false);
      toast.error("답변 등록에 실패했어요: " + error.message);
      return;
    }

    fetch("/api/support/notify-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId }),
    }).catch(() => {});

    setReplyBody("");
    setSendingReply(false);
    toast.success("답변을 등록했어요.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>처리 상태</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label>상태</Label>
            <Select
              value={statusValue}
              onValueChange={(value) => value && updateStatus(value)}
              items={SUPPORT_TICKET_STATUS_LABEL}
            >
              <SelectTrigger className="w-40" disabled={savingStatus}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SUPPORT_TICKET_STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>담당자</Label>
            <Select
              value={assignee}
              onValueChange={(value) => value && updateAssignee(value)}
              items={{
                unassigned: "미지정",
                ...Object.fromEntries(admins.map((a) => [a.id, a.nickname])),
              }}
            >
              <SelectTrigger className="w-40" disabled={savingAssignee}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">미지정</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>내부 메모 (관리자 전용, 사용자에게 노출되지 않음)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 3000))}
            rows={3}
            placeholder="재현 완료, 우선순위 높음, v1.2.0 수정 예정 등"
          />
          <Button size="sm" onClick={saveNote} disabled={savingNote}>
            메모 저장
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>답변</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {replies.length > 0 && (
            <div className="space-y-2">
              {replies.map((r) => (
                <div key={r.id} className="rounded-lg border bg-primary/5 p-3">
                  <p className="whitespace-pre-line text-pretty text-sm leading-relaxed">{r.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
          <Textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value.slice(0, 5000))}
            rows={4}
            placeholder="사용자에게 보여질 답변을 작성하세요."
          />
          <Button onClick={submitReply} disabled={sendingReply}>
            {sendingReply ? "등록 중..." : "답변 등록 (이메일 발송)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
