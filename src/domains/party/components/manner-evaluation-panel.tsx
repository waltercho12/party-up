"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  POSITIVE_MANNER_TAGS,
  NEGATIVE_TAG_GROUPS,
  REPLAY_INTENT_OPTIONS,
  REPORT_REASONS,
  type ReplayIntent,
} from "@/lib/supabase/types";

export interface Reviewee {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  alreadyEvaluated: boolean;
}

const STEP_COUNT = 4;
const REPORT_REQUIRED_TAG = "신고가 필요해요";

function EvaluationRow({
  partyId,
  reviewerId,
  reviewee,
  onSubmitted,
}: {
  partyId: string;
  reviewerId: string;
  reviewee: Reviewee;
  onSubmitted: () => void;
}) {
  const [step, setStep] = useState(0);
  const [replayIntent, setReplayIntent] = useState<ReplayIntent | null>(null);
  const [positiveTags, setPositiveTags] = useState<string[]>([]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [reportReasonCode, setReportReasonCode] = useState("");
  const [reportEvidence, setReportEvidence] = useState("");
  const [loading, setLoading] = useState(false);

  const needsReport = negativeTags.includes(REPORT_REQUIRED_TAG);

  function togglePositive(tag: string) {
    setPositiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function toggleNegative(tag: string) {
    setNegativeTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit() {
    if (!replayIntent) {
      toast.error("다시 함께 플레이하고 싶은지 선택해주세요.");
      setStep(0);
      return;
    }
    if (needsReport && !reportReasonCode) {
      toast.error("신고 사유를 선택해주세요.");
      setStep(2);
      return;
    }
    if (needsReport && !reportEvidence.trim()) {
      toast.error("신고할 상황을 구체적으로 적어주세요.");
      setStep(2);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (needsReport) {
      const { error: reportError } = await supabase.from("reports").insert({
        reporter_id: reviewerId,
        reported_user_id: reviewee.userId,
        party_id: partyId,
        reason_code: reportReasonCode,
        evidence_text: reportEvidence.trim(),
      });
      if (reportError) {
        setLoading(false);
        toast.error("신고 접수에 실패했어요: " + reportError.message);
        return;
      }
    }

    const { error } = await supabase.from("manner_evaluations").insert({
      party_id: partyId,
      reviewer_id: reviewerId,
      reviewee_id: reviewee.userId,
      replay_intent: replayIntent,
      positive_tags: positiveTags,
      negative_tags: negativeTags,
      comment: comment.trim() || null,
    });
    setLoading(false);

    if (error) {
      toast.error("평가 제출에 실패했어요: " + error.message);
      return;
    }

    toast.success(
      needsReport
        ? `${reviewee.nickname}님에 대한 평가와 신고를 접수했어요.`
        : `${reviewee.nickname}님에 대한 평가를 남겼어요.`
    );
    onSubmitted();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={reviewee.avatarUrl ?? undefined} alt={reviewee.nickname} />
            <AvatarFallback>{reviewee.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">{reviewee.nickname}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {step + 1} / {STEP_COUNT}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">이 사람과 다시 함께 플레이하고 싶나요?</p>
            <div className="flex flex-wrap gap-2">
              {REPLAY_INTENT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={replayIntent === opt.value ? "default" : "outline"}
                  onClick={() => setReplayIntent(opt.value)}
                >
                  {opt.emoji} {opt.label}
                </Button>
              ))}
            </div>
            <Button size="sm" disabled={!replayIntent} onClick={() => setStep(1)}>
              다음
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">좋았던 점 (복수 선택, 선택 사항)</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {POSITIVE_MANNER_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={positiveTags.includes(tag)} onCheckedChange={() => togglePositive(tag)} />
                  {tag}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(0)}>
                이전
              </Button>
              <Button size="sm" onClick={() => setStep(2)}>
                다음
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">아쉬웠던 점 (복수 선택, 선택 사항)</p>
            <div className="space-y-3">
              {NEGATIVE_TAG_GROUPS.map((group) => (
                <div key={group.severity} className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {group.tags.map((tag) => (
                      <label key={tag} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={negativeTags.includes(tag)}
                          onCheckedChange={() => toggleNegative(tag)}
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {needsReport && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">신고 접수를 위해 정확한 사유를 알려주세요</p>
                <p className="text-xs text-muted-foreground">
                  자동으로 신고되지 않아요. 아래 내용으로 실제 신고가 접수돼요.
                </p>
                <div className="space-y-2">
                  <Label>사유</Label>
                  <Select
                    value={reportReasonCode}
                    onValueChange={(value) => setReportReasonCode(value ?? "")}
                    items={Object.fromEntries(REPORT_REASONS.map((r) => [r.code, r.label]))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="사유를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORT_REASONS.map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>증거 / 상황 설명</Label>
                  <Textarea
                    value={reportEvidence}
                    onChange={(e) => setReportEvidence(e.target.value)}
                    placeholder="어떤 상황이었는지 구체적으로 적어주세요."
                    rows={3}
                    maxLength={1000}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                이전
              </Button>
              <Button
                size="sm"
                disabled={needsReport && (!reportReasonCode || !reportEvidence.trim())}
                onClick={() => setStep(3)}
              >
                다음
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">자유 의견 (선택 사항)</p>
            <p className="text-xs text-muted-foreground">상대에게 공개되지 않아요.</p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                이전
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={loading}>
                평가 제출
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MannerEvaluationPanel({
  partyId,
  reviewerId,
  reviewees,
}: {
  partyId: string;
  reviewerId: string;
  reviewees: Reviewee[];
}) {
  const router = useRouter();
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);

  const pending = reviewees.filter(
    (r) => !r.alreadyEvaluated && !submittedIds.includes(r.userId)
  );
  const done = reviewees.filter(
    (r) => r.alreadyEvaluated || submittedIds.includes(r.userId)
  );

  if (reviewees.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">함께한 경험 평가</h2>
        <p className="text-sm text-muted-foreground">
          사람이 아니라 함께 플레이한 경험을 평가해주세요. 평가 방식은 공개되지 않아요.
        </p>
      </div>

      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map((reviewee) => (
            <EvaluationRow
              key={reviewee.userId}
              partyId={partyId}
              reviewerId={reviewerId}
              reviewee={reviewee}
              onSubmitted={() => {
                setSubmittedIds((prev) => [...prev, reviewee.userId]);
                router.refresh();
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">모든 평가를 마쳤어요. 함께해주셔서 감사해요.</p>
      )}

      {done.length > 0 && pending.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {done.map((d) => d.nickname).join(", ")}님은 이미 평가했어요.
        </p>
      )}
    </div>
  );
}
