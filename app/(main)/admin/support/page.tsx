import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { Card, CardContent } from "@/components/ui/card";
import { AdminTabs } from "../admin-tabs";
import { SupportFilters } from "@/domains/support/components/support-filters";
import {
  SUPPORT_TICKET_TYPE_LABEL,
  SUPPORT_TICKET_STATUS_LABEL,
  SUPPORT_TICKET_STATUS_EMOJI,
} from "@/domains/support/constants";
import type { SupportTicketType, SupportTicketStatus } from "@/domains/support/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodStart(period: string | undefined): string | null {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (period === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; period?: string; sort?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;

  const [{ data: statsRows }, ticketsQuery] = await Promise.all([
    supabase.rpc("get_support_dashboard_stats"),
    (async () => {
      let query = supabase
        .from("support_tickets")
        .select(
          "id, ticket_number, ticket_type, subject, email, status, assignee_id, created_at, user:profiles!support_tickets_user_id_fkey(nickname), assignee:profiles!support_tickets_assignee_id_fkey(nickname)"
        );

      if (params.q) {
        const q = params.q.replace(/[%,]/g, "");
        query = query.or(`subject.ilike.%${q}%,email.ilike.%${q}%,content.ilike.%${q}%`);
      }
      if (params.status) query = query.eq("status", params.status as SupportTicketStatus);
      if (params.type) query = query.eq("ticket_type", params.type as SupportTicketType);
      const since = periodStart(params.period);
      if (since) query = query.gte("created_at", since);

      query = query.order("created_at", { ascending: params.sort === "oldest" });
      return query;
    })(),
  ]);

  const stats = statsRows?.[0];
  const tickets = ticketsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">관리자</h1>
        <p className="mt-1 text-sm text-muted-foreground">고객지원 문의를 확인하고 처리하세요.</p>
      </div>

      <AdminTabs active="support" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">{stats?.today_created ?? 0}</p>
            <p className="text-xs text-muted-foreground">오늘 접수</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">{stats?.unresolved ?? 0}</p>
            <p className="text-xs text-muted-foreground">미처리</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">{stats?.in_progress ?? 0}</p>
            <p className="text-xs text-muted-foreground">처리 중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">{stats?.today_resolved ?? 0}</p>
            <p className="text-xs text-muted-foreground">오늘 해결</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">
              {stats?.avg_resolution_hours != null ? `${stats.avg_resolution_hours}h` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">평균 처리 시간</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-2xl font-semibold">
              {stats?.week_satisfaction_pct != null ? `${stats.week_satisfaction_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">이번 주 만족도</p>
          </CardContent>
        </Card>
      </div>

      <SupportFilters />

      {tickets.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">문의번호</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">작성자</th>
                <th className="px-3 py-2">등록일</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">담당자</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const userProfile = t.user as unknown as { nickname: string } | null;
                const assignee = t.assignee as unknown as { nickname: string } | null;
                return (
                  <tr key={t.id} className="border-t hover:bg-accent">
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block">
                        #{t.ticket_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block">
                        {SUPPORT_TICKET_TYPE_LABEL[t.ticket_type as SupportTicketType]}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block max-w-xs truncate">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block">
                        {userProfile?.nickname ?? t.email}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block whitespace-nowrap">
                        {formatDateTime(t.created_at)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block whitespace-nowrap">
                        {SUPPORT_TICKET_STATUS_EMOJI[t.status as SupportTicketStatus]}{" "}
                        {SUPPORT_TICKET_STATUS_LABEL[t.status as SupportTicketStatus]}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/admin/support/${t.id}`} className="block">
                        {assignee?.nickname ?? "—"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">조건에 맞는 문의가 없어요.</p>
      )}
    </div>
  );
}
