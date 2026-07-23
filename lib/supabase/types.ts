export type PartyStatus = "recruiting" | "in_progress" | "completed" | "cancelled";
export type MemberStatus = "pending" | "accepted" | "rejected" | "left" | "withdrawn";
export type ReportStatus = "pending" | "reviewed" | "dismissed";
export type ReputationTier = "traveler" | "mate" | "friend" | "guide" | "companion";
export type NotificationType =
  | "application_received"
  | "application_accepted"
  | "application_rejected"
  | "application_withdrawn"
  | "party_expired";

export type ReplayIntent = "yes" | "neutral" | "no";

export const REPLAY_INTENT_OPTIONS: { value: ReplayIntent; emoji: string; label: string }[] = [
  { value: "yes", emoji: "😊", label: "네, 다시 함께 플레이하고 싶어요" },
  { value: "neutral", emoji: "😐", label: "보통이에요" },
  { value: "no", emoji: "🙁", label: "아니요" },
];

export const POSITIVE_MANNER_TAGS = [
  "시간 약속을 잘 지켜요",
  "분위기를 좋게 만들어요",
  "소통이 편해요",
  "끝까지 함께 플레이했어요",
  "초보를 배려해요",
] as const;

export type NegativeTagSeverity = "minor" | "major" | "critical";

export const NEGATIVE_TAG_GROUPS: {
  severity: NegativeTagSeverity;
  label: string;
  tags: readonly string[];
}[] = [
  { severity: "minor", label: "가벼움", tags: ["소통이 어려웠어요"] },
  { severity: "major", label: "심각", tags: ["약속 시간에 늦었어요"] },
  {
    severity: "critical",
    label: "매우 심각",
    tags: ["약속 없이 중간에 나갔어요", "욕설 또는 비매너가 있었어요", "신고가 필요해요"],
  },
];

export const NEGATIVE_MANNER_TAGS = NEGATIVE_TAG_GROUPS.flatMap((g) => g.tags);

export type MannerTag =
  | (typeof POSITIVE_MANNER_TAGS)[number]
  | (typeof NEGATIVE_MANNER_TAGS)[number];

export const REPUTATION_TIER_LABEL: Record<ReputationTier, string> = {
  traveler: "여행자",
  mate: "동료",
  friend: "친구",
  guide: "길잡이",
  companion: "동반자",
};

// A one-line motto for the tier the viewer currently holds, shown big.
export const REPUTATION_TIER_MOTTO: Record<ReputationTier, string> = {
  traveler: "좋은 사람들과의 첫 만남을 시작하는 사람",
  mate: "함께하며 신뢰를 쌓아가는 사람",
  friend: "다시 함께하고 싶다고 생각하게 만드는 사람",
  guide: "처음 만나도 안심할 수 있는 사람",
  companion: "누구나 다시 함께하고 싶은 사람",
};

// The full-ladder legend shown underneath — same copy across the app.
export const REPUTATION_TIER_DESCRIPTION: Record<ReputationTier, string> = {
  traveler: "첫 여정을 시작한 플레이어입니다.",
  mate: "함께 플레이하며 신뢰를 쌓기 시작했습니다.",
  friend: "좋은 경험을 반복해서 만들어가는 플레이어입니다.",
  guide: "처음 만나는 사람도 안심하고 함께할 수 있는 플레이어입니다.",
  companion: "가장 높은 신뢰를 받은 플레이어입니다.",
};

export const REPORT_REASONS: { code: string; label: string }[] = [
  { code: "no_show", label: "무단 불참/잠수" },
  { code: "abusive_language", label: "욕설/비하 발언" },
  { code: "harassment", label: "괴롭힘/불쾌한 언행" },
  { code: "scam", label: "사기/금전 요구" },
  { code: "other", label: "기타" },
];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "대기중",
  reviewed: "확인 완료",
  dismissed: "기각",
};

export type SuggestionStatus = "pending" | "approved" | "rejected";

export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: "대기중",
  approved: "승인",
  rejected: "반려",
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          nickname: string;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Update: {
          nickname?: string;
          avatar_url?: string | null;
          bio?: string | null;
        };
        Relationships: [];
      };
      games: {
        Row: {
          id: string;
          name: string;
          is_official: boolean;
          icon_url: string | null;
          max_party_size: number | null;
          created_at: string;
        };
        Insert: {
          name: string;
          is_official?: boolean;
          icon_url?: string | null;
          max_party_size?: number | null;
        };
        Update: {
          name?: string;
          is_official?: boolean;
          icon_url?: string | null;
          max_party_size?: number | null;
        };
        Relationships: [];
      };
      custom_game_suggestions: {
        Row: {
          id: string;
          party_id: string | null;
          submitted_name: string;
          submitted_by: string;
          status: string;
          created_at: string;
        };
        Insert: {
          party_id?: string | null;
          submitted_name: string;
          submitted_by: string;
        };
        Update: {
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_game_suggestions_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_game_suggestions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      parties: {
        Row: {
          id: string;
          host_id: string;
          game_id: string;
          title: string;
          description: string | null;
          max_members: number;
          current_members: number;
          status: PartyStatus;
          scheduled_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          host_id: string;
          game_id: string;
          title: string;
          description?: string | null;
          max_members: number;
          scheduled_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          max_members?: number;
          status?: PartyStatus;
          scheduled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "parties_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parties_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
        ];
      };
      party_members: {
        Row: {
          id: string;
          party_id: string;
          user_id: string;
          status: MemberStatus;
          joined_at: string;
        };
        Insert: {
          party_id: string;
          user_id: string;
          status?: MemberStatus;
        };
        Update: {
          status?: MemberStatus;
        };
        Relationships: [
          {
            foreignKeyName: "party_members_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "party_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      manner_evaluations: {
        Row: {
          id: string;
          party_id: string;
          reviewer_id: string;
          reviewee_id: string;
          replay_intent: ReplayIntent;
          positive_tags: string[];
          negative_tags: string[];
          comment: string | null;
          created_at: string;
        };
        Insert: {
          party_id: string;
          reviewer_id: string;
          reviewee_id: string;
          replay_intent: ReplayIntent;
          positive_tags?: string[];
          negative_tags?: string[];
          comment?: string | null;
        };
        Update: {
          replay_intent?: ReplayIntent;
          positive_tags?: string[];
          negative_tags?: string[];
          comment?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "manner_evaluations_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          party_id: string | null;
          actor_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: {
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          party_id: string | null;
          reason_code: string;
          evidence_text: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          reporter_id: string;
          reported_user_id: string;
          party_id?: string | null;
          reason_code: string;
          evidence_text?: string | null;
        };
        Update: {
          status?: ReportStatus;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey";
            columns: ["reported_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_reputation_tier: {
        Args: { target_user_id: string };
        Returns: ReputationTier;
      };
      get_reputation_summary: {
        Args: { target_user_id: string };
        Returns: {
          tier: ReputationTier;
          completed_parties: number;
          replay_ratio_pct: number | null;
          punctual_pct: number | null;
          atmosphere_pct: number | null;
          stayed_full_pct: number | null;
          stats_visible: boolean;
          total_evaluations: number;
        }[];
      };
      blocked_between: {
        Args: { a: string; b: string };
        Returns: boolean;
      };
      get_game_history: {
        Args: { target_user_id: string };
        Returns: { game_name: string; play_count: number }[];
      };
      get_trust_badges: {
        Args: { target_user_id: string };
        Returns: {
          replay_recommended: boolean;
          punctual: boolean;
          easy_communication: boolean;
          stayed_full: boolean;
          beginner_friendly: boolean;
          visible: boolean;
        }[];
      };
      get_play_record: {
        Args: { target_user_id: string };
        Returns: { completed_total: number; completed_last_30d: number; avg_party_size: number }[];
      };
      get_recent_activity: {
        Args: { target_user_id: string; limit_count?: number };
        Returns: { party_id: string; title: string; game_name: string; completed_at: string | null }[];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
