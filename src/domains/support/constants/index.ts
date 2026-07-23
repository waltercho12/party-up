import type { SupportTicketType, SupportTicketStatus } from "@/domains/support/types";

export const SUPPORT_TICKET_TYPE_LABEL: Record<SupportTicketType, string> = {
  question: "질문",
  bug: "버그 제보",
  feature_request: "기능 제안",
  compliment: "칭찬",
  complaint: "불만사항",
  report_related: "신고 관련",
  account_issue: "계정 문제",
  other: "기타",
};

export const SUPPORT_TICKET_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: "접수 완료",
  in_review: "검토 중",
  in_progress: "개발팀 확인 중",
  resolved: "해결 완료",
  closed: "종료",
};

export const SUPPORT_TICKET_STATUS_EMOJI: Record<SupportTicketStatus, string> = {
  open: "🟢",
  in_review: "🟡",
  in_progress: "🔵",
  resolved: "🟢",
  closed: "⚫",
};

export const SUPPORT_TICKET_STATUS_ORDER: SupportTicketStatus[] = [
  "open",
  "in_review",
  "in_progress",
  "resolved",
  "closed",
];

export const SUPPORT_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/gif,application/pdf";
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_MAX_FILES = 5;
