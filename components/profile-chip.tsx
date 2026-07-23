import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReputationBadge } from "@/components/reputation-badge";
import type { ReputationTier } from "@/lib/supabase/types";

export function ProfileChip({
  userId,
  nickname,
  avatarUrl,
  tier,
}: {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  tier: ReputationTier;
}) {
  return (
    <Link
      href={`/profile/${userId}`}
      className="flex items-center gap-2 rounded-lg border p-2 pr-3 transition-colors hover:bg-accent"
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl ?? undefined} alt={nickname} />
        <AvatarFallback>{nickname.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{nickname}</span>
      <ReputationBadge tier={tier} />
    </Link>
  );
}
