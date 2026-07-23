import type { PartyStatus } from "@/lib/supabase/types";

export const PARTY_STATUS_LABEL: Record<PartyStatus, string> = {
  recruiting: "모집중",
  in_progress: "진행중",
  completed: "종료",
  cancelled: "취소됨",
};

export const PARTY_STATUS_BADGE_VARIANT: Record<
  PartyStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  recruiting: "default",
  in_progress: "secondary",
  completed: "outline",
  cancelled: "destructive",
};

export function formatScheduledAt(value: string | null) {
  if (!value) return "일정 미정";
  const date = new Date(value);
  return date.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
