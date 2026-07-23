import { notFound, redirect } from "next/navigation";
import { Paperclip } from "lucide-react";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SUPPORT_TICKET_TYPE_LABEL,
  SUPPORT_TICKET_STATUS_LABEL,
  SUPPORT_TICKET_STATUS_EMOJI,
  SUPPORT_TICKET_STATUS_ORDER,
  type SupportTicketType,
  type SupportTicketStatus,
} from "@/lib/supabase/types";
import { FeedbackForm } from "./feedback-form";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MySupportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, ticket_type, subject, content, status, created_at, updated_at, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!ticket || ticket.user_id !== user.id) notFound();

  const [{ data: attachments }, { data: replies }, { data: history }, { data: feedback }] =
    await Promise.all([
      supabase.from("support_attachments").select("id, file_name, file_path, file_size").eq("ticket_id", id),
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
      supabase.from("support_feedback").select("id, helpful, comment").eq("ticket_id", id).maybeSingle(),
    ]);

  const attachmentLinks = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage
        .from("support-attachments")
        .createSignedUrl(a.file_path, 60 * 10);
      return { ...a, url: data?.signedUrl ?? null };
    })
  );

  const status = ticket.status as SupportTicketStatus;
  const statusIndex = SUPPORT_TICKET_STATUS_ORDER.indexOf(status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">문의번호 #{ticket.ticket_number}</p>
        <h1 className="mt-1 text-xl font-semibold">{ticket.subject}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {SUPPORT_TICKET_TYPE_LABEL[ticket.ticket_type as SupportTicketType]} ·{" "}
          {formatDateTime(ticket.created_at)}
        </p>
      </div>

      {/* Status progress */}
      <Card>
        <CardContent className="pt-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {SUPPORT_TICKET_STATUS_ORDER.filter((s) => s !== "closed" || status === "closed").map(
              (s, i) => (
                <span key={s} className="flex items-center gap-2">
                  <span
                    className={
                      i <= statusIndex
                        ? "font-medium"
                        : "text-muted-foreground/50"
                    }
                  >
                    {SUPPORT_TICKET_STATUS_EMOJI[s]} {SUPPORT_TICKET_STATUS_LABEL[s]}
                  </span>
                  {i < SUPPORT_TICKET_STATUS_ORDER.length - 1 &&
                    !(s === "resolved" && status !== "closed") && <span className="text-muted-foreground/40">→</span>}
                </span>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
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

      {/* Replies */}
      {replies && replies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>운영진 답변</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {replies.map((r) => (
              <div key={r.id} className="rounded-lg border bg-primary/5 p-3">
                <p className="whitespace-pre-line text-pretty text-sm leading-relaxed">{r.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {status === "resolved" && (
        <FeedbackForm
          ticketId={ticket.id}
          existing={feedback ? { helpful: feedback.helpful, comment: feedback.comment } : null}
        />
      )}

      {/* Timeline */}
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
