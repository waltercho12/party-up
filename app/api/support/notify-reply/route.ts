import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryDb } from "@/lib/server-db";
import { sendEmail } from "@/lib/email";
import { isSameOrigin, checkRateLimit, clientIp } from "@/lib/api-security";

interface ReplyRow {
  reply_id: string;
  body: string;
  email: string;
  subject: string;
  ticket_number: string;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!checkRateLimit(`notify-reply:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Defense in depth beyond RLS: re-verify the caller is an admin before
  // trusting anything in the request body.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ticketId = body?.ticketId;
  if (typeof ticketId !== "string") {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  // Idempotent per reply: only the most recent unnotified reply is sent,
  // and only once (email_sent flips false -> true atomically).
  const rows = await queryDb<ReplyRow>(
    `update public.support_replies r
     set email_sent = true
     from public.support_tickets t
     where r.id = (
       select id from public.support_replies
       where ticket_id = $1 and email_sent = false
       order by created_at desc
       limit 1
     )
     and t.id = r.ticket_id
     returning r.id as reply_id, r.body, t.email, t.subject, t.ticket_number`,
    [ticketId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const reply = rows[0];
  const result = await sendEmail({
    to: reply.email,
    subject: "[Party-up] 문의에 답변이 등록되었습니다.",
    html: `
      <p>문의하신 내용에 운영진 답변이 등록됐어요.</p>
      <p><strong>문의번호 #${reply.ticket_number} · ${reply.subject}</strong></p>
      <blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#333;">
        ${reply.body.replace(/\n/g, "<br/>")}
      </blockquote>
      <p>Party-up 고객지원 페이지(/my/support)에서 전체 내용을 확인하실 수 있어요.</p>
    `,
  });

  return NextResponse.json({ ok: true, emailed: result.sent });
}
