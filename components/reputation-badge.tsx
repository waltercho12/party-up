import { Badge } from "@/components/ui/badge";
import { REPUTATION_TIER_LABEL, type ReputationTier } from "@/lib/supabase/types";

const TIER_CLASS: Record<ReputationTier, string> = {
  traveler: "bg-muted text-muted-foreground",
  mate: "bg-secondary text-secondary-foreground",
  friend: "bg-accent text-accent-foreground",
  guide: "bg-primary/15 text-primary",
  companion: "bg-primary text-primary-foreground",
};

export function ReputationBadge({ tier }: { tier: ReputationTier }) {
  return (
    <Badge variant="outline" className={`border-0 ${TIER_CLASS[tier]}`}>
      {REPUTATION_TIER_LABEL[tier]}
    </Badge>
  );
}
