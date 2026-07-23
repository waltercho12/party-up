import { NextResponse, type NextRequest } from "next/server";
import { queryDb } from "@/lib/server-db";
import { sendEmail } from "@/lib/email";
import { isSameOrigin, checkRateLimit, clientIp } from "@/lib/api-security";
import { SUPPORT_TICKET_TYPE_LABEL, type SupportTicketType } from "@/lib/supabase/types";

interface TicketRow {
  ticket_number: string;
  ticket_type: SupportTicketType;
  subject: string;
  email: string;
  created_at: string;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!checkRateLimit(`notify-new:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const ticketId = body?.ticketId;
  if (typeof ticketId !== "string") {
    return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
  }

  // Idempotent: flips admin_notified false -> true and only proceeds if
  // this call is the one that won the flip, so retries/duplicate calls
  // never send a second email for the same ticket.
  const updated = await queryDb<TicketRow>(
    `update public.support_tickets
     set admin_notified = true
     where id = $1 and admin_notified = false
     returning ticket_number, ticket_type, subject, email, created_at`,
    [ticketId]
  );

  if (updated.length === 0) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ticket = updated[0];

  const admins = await queryDb<{ email: string }>(
    `select u.email
     from public.admins a
     join auth.users u on u.id = a.user_id
     where u.email is not null`
  );

  if (admins.length === 0) {
    return NextResponse.json({ ok: true, emailed: false, reason: "no_admins" });
  }

  const createdAt = new Date(ticket.created_at).toLocaleString("ko-KR");
  const result = await sendEmail({
    to: admins.map((a) => a.email),
    subject: "[Party-up] 새로운 문의가 접수되었습니다.",
    html: `
      <p>새로운 고객지원 문의가 접수됐어요.</p>
      <ul>
        <li>문의번호: #${ticket.ticket_number}</li>
        <li>문의 유형: ${SUPPORT_TICKET_TYPE_LABEL[ticket.ticket_type]}</li>
        <li>제목: ${ticket.subject}</li>
        <li>작성자: ${ticket.email}</li>
        <li>등록일: ${createdAt}</li>
      </ul>
      <p>관리자 페이지에서 확인해주세요.</p>
    `,
  });

  return NextResponse.json({ ok: true, emailed: result.sent });
}
