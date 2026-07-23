import type { NotificationType } from "@/lib/supabase/types";

export function notificationMessage(
  type: NotificationType,
  context: { partyTitle?: string | null; actorNickname?: string | null; supportSubject?: string | null }
): string {
  const partyTitle = context.partyTitle ?? "삭제된 파티";
  const actorNickname = context.actorNickname ?? null;

  switch (type) {
    case "application_received":
      return `${actorNickname ?? "누군가"}님이 "${partyTitle}" 파티에 참가 신청했어요.`;
    case "application_accepted":
      return `"${partyTitle}" 파티 참가가 수락됐어요.`;
    case "application_rejected":
      return `"${partyTitle}" 파티 참가가 거절됐어요.`;
    case "application_withdrawn":
      return `다른 파티에 참가가 확정되어 "${partyTitle}" 파티 신청이 자동 취소됐어요.`;
    case "party_expired":
      return `오랫동안 반응이 없어 "${partyTitle}" 모집글이 자동으로 마감됐어요.`;
    case "support_reply":
      return `"${context.supportSubject ?? "문의"}"에 운영진 답변이 등록됐어요.`;
  }
}
