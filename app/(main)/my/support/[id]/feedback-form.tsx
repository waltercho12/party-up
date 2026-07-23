"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FeedbackForm({
  ticketId,
  existing,
}: {
  ticketId: string;
  existing: { helpful: boolean; comment: string | null } | null;
}) {
  const router = useRouter();
  const [helpful, setHelpful] = useState<boolean | null>(existing?.helpful ?? null);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(!!existing);

  async function handleSubmit(value: boolean) {
    setHelpful(value);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("support_feedback").insert({
      ticket_id: ticketId,
      helpful: value,
      comment: comment.trim() || null,
    });
    setLoading(false);

    if (error) {
      toast.error("의견 등록에 실패했어요: " + error.message);
      return;
    }
    setSubmitted(true);
    toast.success("소중한 의견 감사해요.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>이번 답변이 도움이 되었나요?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submitted ? (
          <p className="text-sm text-muted-foreground">
            {helpful ? "👍 도움이 되었어요" : "👎 도움이 되지 않았어요"}
            {comment && ` — "${comment}"`}
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => handleSubmit(true)}
              >
                👍 도움이 되었어요
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => handleSubmit(false)}
              >
                👎 도움이 되지 않았어요
              </Button>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 300))}
              maxLength={300}
              placeholder="추가 의견 (선택)"
              rows={2}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
