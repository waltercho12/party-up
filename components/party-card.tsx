import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PartyStatus } from "@/lib/supabase/types";
import { PARTY_STATUS_BADGE_VARIANT, PARTY_STATUS_LABEL, formatScheduledAt } from "@/lib/party-labels";

export interface PartyCardData {
  id: string;
  title: string;
  description: string | null;
  max_members: number;
  current_members: number;
  status: PartyStatus;
  scheduled_at: string | null;
  host_id: string;
  game: { name: string } | null;
  host: { nickname: string } | null;
}

export function PartyCard({ party, isMine }: { party: PartyCardData; isMine?: boolean }) {
  return (
    <Link href={`/parties/${party.id}`}>
      <Card
        className={
          isMine
            ? "h-full border-2 border-blue-500 transition-colors dark:border-blue-400"
            : "h-full transition-colors hover:border-primary/50"
        }
      >
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{party.game?.name ?? "기타"}</p>
            <h3 className="mt-1 font-semibold leading-snug">{party.title}</h3>
          </div>
          <Badge variant={PARTY_STATUS_BADGE_VARIANT[party.status]}>
            {PARTY_STATUS_LABEL[party.status]}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {party.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{party.description}</p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatScheduledAt(party.scheduled_at)}</span>
            <span>
              {party.current_members}/{party.max_members}명 · {party.host?.nickname ?? "알 수 없음"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
