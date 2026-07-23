export type SupportTicketType =
  | "question"
  | "bug"
  | "feature_request"
  | "compliment"
  | "complaint"
  | "report_related"
  | "account_issue"
  | "other";

export type SupportTicketStatus = "open" | "in_review" | "in_progress" | "resolved" | "closed";
