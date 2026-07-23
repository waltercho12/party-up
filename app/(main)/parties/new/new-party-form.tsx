"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CUSTOM_GAME_VALUE = "__custom__";
const FALLBACK_CAP = 20;
const QUARTER_MINUTES = ["00", "15", "30", "45"] as const;
const HOUR12_LIST = Array.from({ length: 12 }, (_, i) => String(i + 1));
const AMPM_LIST = ["오전", "오후"] as const;

interface Game {
  id: string;
  name: string;
  max_party_size: number | null;
}

function toLocalDateValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 12h + AM/PM -> 24h, for comparisons and for building the final Date.
function hour24From(ampm: string, hour12: string) {
  const h = Number(hour12);
  if (ampm === "오전") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

function nextQuarterHour(date: Date) {
  let hour = date.getHours();
  let minute = Math.ceil(date.getMinutes() / 15) * 15;
  if (minute === 60) {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  const ampm = hour < 12 ? "오전" : "오후";
  const hour12 = String(hour % 12 === 0 ? 12 : hour % 12);
  return { ampm, hour12, minute: String(minute).padStart(2, "0") };
}

export function NewPartyForm({ userId, games }: { userId: string; games: Game[] }) {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);
  // "기타" is a fixed placeholder game every custom-named party points to
  // (see (5) in the migration) — never shown as its own dropdown option,
  // only used behind the scenes to resolve the custom entry's game_id.
  const etcGame = games.find((g) => g.name === "기타");
  const visibleGames = games.filter((g) => g.name !== "기타");

  const [gameId, setGameId] = useState("");
  const [customGameName, setCustomGameName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledAmpm, setScheduledAmpm] = useState("");
  const [scheduledHour12, setScheduledHour12] = useState("");
  const [scheduledMinute, setScheduledMinute] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedGame =
    gameId === CUSTOM_GAME_VALUE ? etcGame : visibleGames.find((g) => g.id === gameId);
  const cap = selectedGame?.max_party_size ?? FALLBACK_CAP;

  // Today's date picked -> filter out AM/PM, hour, minute options that have
  // already passed, so a past time can't be selected in the first place
  // (not just rejected on submit).
  const now = new Date();
  const isToday = scheduledDate === toLocalDateValue(now);
  const currentHour24 = now.getHours();
  const currentMinute = now.getMinutes();

  function availableHoursFor(ampm: string) {
    if (!isToday) return HOUR12_LIST;
    return HOUR12_LIST.filter((h) => hour24From(ampm, h) >= currentHour24);
  }

  const availableAmpm = isToday
    ? AMPM_LIST.filter((a) => availableHoursFor(a).length > 0)
    : AMPM_LIST;
  const availableHours = scheduledAmpm ? availableHoursFor(scheduledAmpm) : HOUR12_LIST;
  const availableMinutes = (() => {
    if (!isToday || !scheduledAmpm || !scheduledHour12) return QUARTER_MINUTES;
    const h24 = hour24From(scheduledAmpm, scheduledHour12);
    if (h24 > currentHour24) return QUARTER_MINUTES;
    return QUARTER_MINUTES.filter((m) => Number(m) >= currentMinute);
  })();

  function handleGameChange(value: string | null) {
    const id = value ?? "";
    setGameId(id);
    const nextGame = id === CUSTOM_GAME_VALUE ? etcGame : visibleGames.find((g) => g.id === id);
    const nextCap = nextGame?.max_party_size ?? FALLBACK_CAP;
    setMaxMembers((prev) => {
      const n = Number(prev);
      if (!prev || !n || n > nextCap) return String(Math.min(4, nextCap));
      return prev;
    });
  }

  function openDatePicker() {
    try {
      dateInputRef.current?.showPicker?.();
    } catch {
      // unsupported browser — the native date field can still be used directly
    }
  }

  // Changing an earlier field can invalidate later ones (e.g. picking today
  // after an evening hour was already selected), so each change resets what
  // comes after it and re-defaults to the next available quarter hour.
  function handleDateChange(value: string) {
    setScheduledDate(value);
    if (value) {
      const { ampm, hour12, minute } = nextQuarterHour(new Date());
      setScheduledAmpm(ampm);
      setScheduledHour12(hour12);
      setScheduledMinute(minute);
    } else {
      setScheduledAmpm("");
      setScheduledHour12("");
      setScheduledMinute("");
    }
  }

  function handleAmpmChange(value: string | null) {
    setScheduledAmpm(value ?? "");
    setScheduledHour12("");
    setScheduledMinute("");
  }

  function handleHourChange(value: string | null) {
    const hour = value ?? "";
    setScheduledHour12(hour);
    if (!hour) {
      setScheduledMinute("");
      return;
    }
    // Default to the top of the hour unless that's already past for today.
    if (isToday && scheduledAmpm && hour24From(scheduledAmpm, hour) === currentHour24) {
      setScheduledMinute(QUARTER_MINUTES.find((m) => Number(m) >= currentMinute) ?? "");
      return;
    }
    setScheduledMinute("00");
  }

  function combineScheduledAt(): Date | null {
    if (!scheduledDate || !scheduledAmpm || !scheduledHour12 || !scheduledMinute) return null;
    const [y, m, d] = scheduledDate.split("-").map(Number);
    return new Date(y, m - 1, d, hour24From(scheduledAmpm, scheduledHour12), Number(scheduledMinute), 0, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!gameId) {
      toast.error("게임을 선택해주세요.");
      return;
    }
    if (gameId === CUSTOM_GAME_VALUE && !customGameName.trim()) {
      toast.error("게임 이름을 입력해주세요.");
      return;
    }
    if (gameId === CUSTOM_GAME_VALUE && !etcGame) {
      toast.error("게임 등록에 필요한 설정이 누락됐어요. 관리자에게 문의해주세요.");
      return;
    }
    const membersCount = Number(maxMembers);
    if (!membersCount || membersCount < 1 || membersCount > cap) {
      toast.error(`모집 인원은 1명 이상 ${cap}명 이하로 입력해주세요.`);
      return;
    }
    if (scheduledDate && (!scheduledAmpm || !scheduledHour12 || !scheduledMinute)) {
      toast.error("시간을 선택해주세요.");
      return;
    }
    const scheduledDateTime = combineScheduledAt();
    if (scheduledDateTime && scheduledDateTime < new Date()) {
      toast.error("일정은 현재 시각 이후로 선택해주세요.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const resolvedGameId = gameId === CUSTOM_GAME_VALUE ? etcGame!.id : gameId;
    const customName = gameId === CUSTOM_GAME_VALUE ? customGameName.trim() : null;

    const { data: party, error } = await supabase
      .from("parties")
      .insert({
        host_id: userId,
        game_id: resolvedGameId,
        title: title.trim(),
        description: description.trim() || null,
        max_members: membersCount,
        scheduled_at: scheduledDateTime ? scheduledDateTime.toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !party) {
      setLoading(false);
      toast.error("모집글 작성에 실패했어요: " + error?.message);
      return;
    }

    if (customName) {
      const { error: suggestionError } = await supabase.from("custom_game_suggestions").insert({
        party_id: party.id,
        submitted_name: customName,
        submitted_by: userId,
      });
      if (suggestionError) {
        console.error("custom game suggestion insert failed", suggestionError);
      }
    }

    setLoading(false);
    toast.success("모집글을 올렸어요.");
    router.push(`/parties/${party.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>게임</Label>
        <Select
          value={gameId}
          onValueChange={handleGameChange}
          items={{
            ...Object.fromEntries(visibleGames.map((game) => [game.id, game.name])),
            [CUSTOM_GAME_VALUE]: "기타 (직접 입력)",
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="게임을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {visibleGames.map((game) => (
              <SelectItem key={game.id} value={game.id}>
                {game.name}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_GAME_VALUE}>기타 (직접 입력)</SelectItem>
          </SelectContent>
        </Select>
        {gameId === CUSTOM_GAME_VALUE && (
          <>
            <Input
              className="mt-2"
              placeholder="게임 이름을 입력해주세요"
              value={customGameName}
              onChange={(e) => setCustomGameName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              입력하신 게임명은 다른 사람에게 공개되지 않고 &quot;기타&quot;로 표시돼요.
              검토 후 필요하면 정식 게임 목록에 추가할게요.
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">설명</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder="어떤 분위기로 게임하고 싶은지, 원하는 스타일을 적어주세요."
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-members">모집 인원</Label>
        <Input
          id="max-members"
          type="number"
          min={1}
          max={cap}
          value={maxMembers}
          onChange={(e) => setMaxMembers(e.target.value)}
          disabled={!gameId}
          required
        />
        <p className="text-xs text-muted-foreground">
          {gameId ? `이 게임은 최대 ${cap}명까지 모집할 수 있어요.` : "게임을 먼저 선택해주세요."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduled-date">일정 (선택)</Label>
        <Input
          ref={dateInputRef}
          id="scheduled-date"
          type="date"
          min={toLocalDateValue(new Date())}
          value={scheduledDate}
          onChange={(e) => handleDateChange(e.target.value)}
          onClick={openDatePicker}
          className="cursor-pointer"
        />
        {scheduledDate && (
          <div className="grid grid-cols-3 gap-2">
            <Select
              value={scheduledAmpm}
              onValueChange={handleAmpmChange}
              items={Object.fromEntries(availableAmpm.map((a) => [a, a]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="오전/오후" />
              </SelectTrigger>
              <SelectContent>
                {availableAmpm.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={scheduledHour12}
              onValueChange={handleHourChange}
              items={Object.fromEntries(availableHours.map((h) => [h, `${h}시`]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="시" />
              </SelectTrigger>
              <SelectContent>
                {availableHours.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}시
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={scheduledMinute}
              onValueChange={(v) => setScheduledMinute(v ?? "")}
              items={Object.fromEntries(availableMinutes.map((m) => [m, `${m}분`]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="분" />
              </SelectTrigger>
              <SelectContent>
                {availableMinutes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}분
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        모집글 올리기
      </Button>
    </form>
  );
}
