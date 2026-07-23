import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import {
  REPORT_REASONS,
  REPORT_STATUS_LABEL,
  SUGGESTION_STATUS_LABEL,
  type ReportStatus,
  type SuggestionStatus,
} from "@/lib/supabase/types";
import { ReportStatusControls } from "./report-status-controls";
import { SuggestionStatusControls } from "./suggestion-status-controls";
import { AdminTabs } from "./admin-tabs";

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.code, r.label]));

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();

  const [{ data: reports }, { data: suggestions }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, reason_code, evidence_text, status, created_at, party_id, reporter:profiles!reports_reporter_id_fkey(nickname), reported:profiles!reports_reported_user_id_fkey(id, nickname)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("custom_game_suggestions")
      .select(
        "id, submitted_name, status, created_at, party_id, submitter:profiles!custom_game_suggestions_submitted_by_fkey(nickname)"
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div>
        <h1 className="text-2xl font-semibold">관리자</h1>
        <p className="mt-1 text-sm text-muted-foreground">신고와 게임 등록 제안을 확인하세요.</p>
      </div>

      <AdminTabs active="reports" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">신고 ({reports?.length ?? 0})</h2>
        {reports && reports.length > 0 ? (
          <ul className="space-y-3">
            {reports.map((report) => {
              const reporter = report.reporter as unknown as { nickname: string } | null;
              const reported = report.reported as unknown as { id: string; nickname: string } | null;
              return (
                <li key={report.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{reporter?.nickname ?? "알 수 없음"}</span>님이{" "}
                      {reported ? (
                        <Link href={`/profile/${reported.id}`} className="font-medium underline">
                          {reported.nickname}
                        </Link>
                      ) : (
                        "알 수 없음"
                      )}
                      님을 신고했어요
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {REPORT_STATUS_LABEL[report.status as ReportStatus]}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">사유:</span>{" "}
                    {REASON_LABEL[report.reason_code] ?? report.reason_code}
                  </p>
                  {report.evidence_text && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {report.evidence_text}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{formatDate(report.created_at)}</p>
                    <ReportStatusControls id={report.id} status={report.status as ReportStatus} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">접수된 신고가 없어요.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">게임 등록 제안 ({suggestions?.length ?? 0})</h2>
        {suggestions && suggestions.length > 0 ? (
          <ul className="space-y-3">
            {suggestions.map((s) => {
              const submitter = s.submitter as unknown as { nickname: string } | null;
              return (
                <li key={s.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{s.submitted_name}</p>
                    <span className="text-xs text-muted-foreground">
                      {SUGGESTION_STATUS_LABEL[s.status as SuggestionStatus]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {submitter?.nickname ?? "알 수 없음"}님 제안 ·{" "}
                    {s.party_id && (
                      <Link href={`/parties/${s.party_id}`} className="underline">
                        모집글 보기
                      </Link>
                    )}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{formatDate(s.created_at)}</p>
                    <SuggestionStatusControls
                      id={s.id}
                      status={s.status as SuggestionStatus}
                      submittedName={s.submitted_name}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">아직 제안된 게임이 없어요.</p>
        )}
      </section>
    </div>
  );
}
