import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  SUPPORT_TICKET_TYPE_LABEL,
  SUPPORT_TICKET_STATUS_LABEL,
  SUPPORT_TICKET_STATUS_EMOJI,
  type SupportTicketType,
  type SupportTicketStatus,
} from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function MySupportPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, ticket_type, subject, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">내 문의 내역</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          보내신 문의가 지금 어디까지 처리됐는지 확인할 수 있어요.
        </p>
      </div>

      {tickets && tickets.length > 0 ? (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/my/support/${t.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between gap-3 pt-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {SUPPORT_TICKET_TYPE_LABEL[t.ticket_type as SupportTicketType]} ·{" "}
                        {formatDate(t.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium">
                      {SUPPORT_TICKET_STATUS_EMOJI[t.status as SupportTicketStatus]}{" "}
                      {SUPPORT_TICKET_STATUS_LABEL[t.status as SupportTicketStatus]}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">아직 보낸 문의가 없어요.</p>
      )}
    </div>
  );
}
