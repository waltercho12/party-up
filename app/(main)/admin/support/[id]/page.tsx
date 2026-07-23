import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { requireAdmin } from "@/lib/require-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SUPPORT_TICKET_TYPE_LABEL,
  type SupportTicketType,
} from "@/lib/supabase/types";
import { AdminTicketActions } from "./admin-ticket-actions";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(
      "id, ticket_number, ticket_type, subject, content, email, status, assignee_id, internal_note, created_at, updated_at, user:profiles!support_tickets_user_id_fkey(nickname)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();

  const [{ data: attachments }, { data: replies }, { data: history }, { data: admins }] =
    await Promise.all([
      supabase.from("support_attachments").select("id, file_name, file_path").eq("ticket_id", id),
      supabase
        .from("support_replies")
        .select("id, body, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("support_history")
        .select("id, description, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("admins").select("user_id, profile:profiles!admins_user_id_fkey(nickname)"),
    ]);

  const attachmentLinks = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(a.file_path, 60 * 10);
      return { ...a, url: data?.signedUrl ?? null };
    })
  );

  const requester = ticket.user as unknown as { nickname: string } | null;
  const adminOptions = (admins ?? []).map((a) => ({
    id: a.user_id,
    nickname: (a.profile as unknown as { nickname: string } | null)?.nickname ?? "관리자",
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">문의번호 #{ticket.ticket_number}</p>
        <h1 className="mt-1 text-xl font-semibold">{ticket.subject}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {SUPPORT_TICKET_TYPE_LABEL[ticket.ticket_type as SupportTicketType]} ·{" "}
          {requester?.nickname ?? "비회원"} ({ticket.email}) · {formatDateTime(ticket.created_at)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>문의 내용</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-line text-pretty text-sm leading-relaxed">{ticket.content}</p>
          {attachmentLinks.length > 0 && (
            <ul className="space-y-1">
              {attachmentLinks.map((a) => (
                <li key={a.id}>
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Paperclip className="size-4" />
                      {a.file_name}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="size-4" />
                      {a.file_name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AdminTicketActions
        ticketId={ticket.id}
        status={ticket.status}
        assigneeId={ticket.assignee_id}
        internalNote={ticket.internal_note}
        admins={adminOptions}
        replies={replies ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle>처리 Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 border-l-2 border-border pl-4">
            {(history ?? []).map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
                <p className="text-sm font-medium">{h.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
