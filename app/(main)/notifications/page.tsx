import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { notificationMessage } from "@/lib/notifications";
import type { NotificationType } from "@/lib/supabase/types";

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select(
      "id, type, party_id, support_ticket_id, read_at, created_at, party:parties(title), support_ticket:support_tickets(subject), actor:profiles!notifications_actor_id_fkey(nickname)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unreadIds = (notifications ?? []).filter((n) => !n.read_at).map((n) => n.id);
  if (unreadIds.length > 0) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">알림</h1>

      {notifications && notifications.length > 0 ? (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const party = n.party as unknown as { title: string } | null;
            const supportTicket = n.support_ticket as unknown as { subject: string } | null;
            const actor = n.actor as unknown as { nickname: string } | null;
            const wasUnread = unreadIds.includes(n.id);
            const href = n.support_ticket_id
              ? `/my/support/${n.support_ticket_id}`
              : n.party_id
                ? `/parties/${n.party_id}`
                : "#";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={`block rounded-lg border p-3 text-sm transition-colors hover:bg-accent ${
                    wasUnread ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <p>
                    {notificationMessage(n.type as NotificationType, {
                      partyTitle: party?.title,
                      actorNickname: actor?.nickname,
                      supportSubject: supportTicket?.subject,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.created_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">아직 알림이 없어요.</p>
      )}
    </div>
  );
}
