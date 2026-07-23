"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTY_STATUS_LABEL } from "@/domains/party/constants";

// Completed/cancelled parties aren't publicly browsable anymore (only the
// host, participants, and admins can see them), so they're intentionally
// left out of this filter — selecting them would just show an empty list
// for anyone else.
const BROWSABLE_STATUSES = ["recruiting", "in_progress"] as const;

export function PartyFilters({
  games,
  gameCounts,
}: {
  games: { id: string; name: string }[];
  gameCounts: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/parties?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        defaultValue={searchParams.get("game") ?? "all"}
        onValueChange={(value) => updateParam("game", value)}
        items={{
          all: "전체 게임",
          ...Object.fromEntries(games.map((game) => [game.id, game.name])),
        }}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="게임" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 게임</SelectItem>
          {games.map((game) => (
            <SelectItem key={game.id} value={game.id}>
              <span className="flex w-full items-center justify-between gap-3">
                <span>{game.name}</span>
                <span className="text-xs text-muted-foreground">
                  {gameCounts[game.id] ?? 0}개 모집중
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(value) => updateParam("status", value)}
        items={{
          all: "모집중 + 진행중",
          ...Object.fromEntries(BROWSABLE_STATUSES.map((s) => [s, PARTY_STATUS_LABEL[s]])),
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">모집중 + 진행중</SelectItem>
          {BROWSABLE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {PARTY_STATUS_LABEL[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
