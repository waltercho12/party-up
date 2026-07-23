import Link from "next/link";
import {
  LogIn,
  Search,
  UserCheck,
  Send,
  ThumbsUp,
  Gamepad2,
  Flag,
  Star,
  EyeOff,
  Lock,
  FileCheck2,
  MessageSquareOff,
  UserX,
  Gamepad,
  PenLine,
  Users,
  CalendarClock,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReputationBadge } from "@/components/reputation-badge";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { MarketingHeader } from "@/components/marketing-header";
import type { ReputationTier } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const HERO_BODY = `게임은 혼자서도 즐길 수 있지만,
좋은 사람과 함께한 게임은 오래 기억됩니다.
Party-up은 함께하고 싶은 사람을 만나,
모든 게임이 즐거운 경험이 될 수 있도록 돕습니다.`;

const REPUTATION_INTRO = `Party-up의 평판은 실력이나 인기 점수가 아닙니다.
함께 플레이한 사람들의 경험이 쌓여
조금씩 신뢰가 만들어집니다.

좋은 사람과 반복해서 함께하고 싶다는 마음,
그것이 Party-up 평판의 기준입니다.`;

const REPUTATION_CLOSING = `평판은 숫자로 경쟁하는 시스템이 아닙니다.
좋은 경험이 쌓이면,
신뢰도 자연스럽게 함께 쌓입니다.`;

const FINAL_CTA_BODY = `혼자 하는 게임도 좋지만,
좋은 사람과 함께하는 게임은 더 오래 기억됩니다.
오늘 함께할 새로운 파티를 찾아보세요.`;

const TIERS: { tier: ReputationTier; description: string }[] = [
  {
    tier: "traveler",
    description: `이제 첫 여정을 시작한 플레이어입니다.
좋은 사람들과의 첫 만남이
여기서부터 시작됩니다.`,
  },
  {
    tier: "mate",
    description: `함께 플레이하며
신뢰를 쌓기 시작한 단계입니다.
좋은 경험들이 하나둘 모여가고 있습니다.`,
  },
  {
    tier: "friend",
    description: `다양한 사람들과
즐거운 경험을 반복해서 만들어가는 플레이어입니다.
많은 사람들이 다시 함께하고 싶다고 생각하기 시작합니다.`,
  },
  {
    tier: "guide",
    description: `처음 만나는 사람도
안심하고 함께할 수 있는 플레이어입니다.
좋은 게임 문화를 만들어가는
믿음직한 존재입니다.`,
  },
  {
    tier: "companion",
    description: `가장 높은 신뢰를 받은 플레이어입니다.
누구나 다시 함께하고 싶은 사람.
Party-up이 가장 자랑하는 플레이어입니다.`,
  },
];

const TIER_DOT_CLASS: Record<ReputationTier, string> = {
  traveler: "bg-muted text-muted-foreground",
  mate: "bg-secondary text-secondary-foreground",
  friend: "bg-accent text-accent-foreground",
  guide: "bg-primary/15 text-primary",
  companion: "bg-primary text-primary-foreground",
};

const BEHAVIORS = [
  "새로운 사람과 함께 게임하기",
  "매너 있게 플레이하기",
  "좋은 사람과 반복적으로 게임하기",
  "다양한 사람들과 게임하기",
  "모든 게임을 존중하기",
];

const USER_FLOW = [
  { icon: LogIn, label: "로그인" },
  { icon: Search, label: "모집글 탐색" },
  { icon: UserCheck, label: "프로필 확인" },
  { icon: Send, label: "참가 신청" },
  { icon: ThumbsUp, label: "수락" },
  { icon: Gamepad2, label: "게임 진행" },
  { icon: Flag, label: "파티 종료" },
  { icon: Star, label: "매너 평가" },
];

const TRUST_SAFETY = [
  { icon: EyeOff, text: "성별은 공개하지 않아요" },
  { icon: Lock, text: "평판 계산 방식은 공개하지 않아요" },
  { icon: FileCheck2, text: "신고는 증거 기반으로 처리해요" },
  { icon: MessageSquareOff, text: "공개 저격 문화를 허용하지 않아요" },
  { icon: UserX, text: "차단 기능을 제공해요" },
];

const HOW_TO = [
  { icon: Gamepad, title: "게임 선택", body: "공식 게임 목록에서 고르거나, 목록에 없다면 직접 이름을 입력해 관리자 검토 후 등록돼요." },
  { icon: PenLine, title: "제목과 소개 작성", body: "어떤 분위기로 플레이하고 싶은지 짧게 알려주면 지원자가 나와 잘 맞는지 가늠할 수 있어요." },
  { icon: Users, title: "모집 인원 설정", body: "게임마다 정해진 최대 인원 안에서 자유롭게 설정할 수 있어요." },
  { icon: CalendarClock, title: "일정 선택 (선택 사항)", body: "날짜와 시간을 정해두면 지원자가 참여 가능 여부를 바로 판단할 수 있어요." },
  { icon: Megaphone, title: "모집글 올리기", body: "올린 뒤엔 지원자를 수락하고, 파티를 진행하고, 종료하면 서로 매너 평가를 남겨요." },
];

export default async function AboutPage() {
  const { user, profile } = await getCurrentProfile();
  const primaryHref = user && profile ? "/parties" : "/login";

  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]"
          />
          <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:py-32">
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-5xl">
              좋은 경험은
              <br />
              좋은 사람에게서 시작됩니다.
            </h1>
            <p className="mt-6 max-w-lg whitespace-pre-line text-pretty leading-relaxed text-muted-foreground sm:text-lg">
              {HERO_BODY}
            </p>
            <Button size="lg" className="mt-10" nativeButton={false} render={<Link href={primaryHref} />}>
              파티 둘러보기
            </Button>
          </div>
        </section>

        {/* Reputation */}
        <section className="border-t bg-muted/30 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-balance text-2xl font-bold sm:text-3xl">
              함께한 시간이
              <br />
              신뢰가 됩니다.
            </h2>
            <p className="mx-auto mt-6 max-w-md whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {REPUTATION_INTRO}
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-xl px-4">
            <ol className="relative space-y-10 border-l-2 border-border pl-8 sm:pl-10">
              {TIERS.map((t, i) => (
                <li key={t.tier} className="relative">
                  <span
                    className={cn(
                      "absolute top-0 flex size-8 -translate-x-[calc(2rem+2px)] items-center justify-center rounded-full text-xs font-bold ring-4 ring-background sm:-translate-x-[calc(2.5rem+2px)] sm:size-9 sm:text-sm",
                      TIER_DOT_CLASS[t.tier]
                    )}
                  >
                    {i + 1}
                  </span>
                  <ReputationBadge tier={t.tier} />
                  <p className="mt-2 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {t.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="mx-auto mt-16 max-w-sm px-4 text-center">
            <p className="whitespace-pre-line text-pretty text-sm italic leading-relaxed text-muted-foreground">
              {REPUTATION_CLOSING}
            </p>
          </div>
        </section>

        {/* How to post */}
        <section className="border-t py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-2xl font-semibold">파티 모집글 작성 방법</h2>
            <ul className="mt-8 space-y-4">
              {HOW_TO.map((step, i) => (
                <li key={step.title} className="flex gap-4 rounded-xl border bg-background p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {i + 1}. {step.title}
                    </p>
                    <p className="mt-1 text-sm text-pretty text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Behaviors we encourage */}
        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-2xl font-semibold">이런 행동을 응원해요</h2>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {BEHAVIORS.map((behavior) => (
                <Badge key={behavior} variant="secondary" className="px-3 py-1.5 text-sm">
                  {behavior}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        {/* User flow */}
        <section className="border-t py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-2xl font-semibold">5분 안에, 이렇게 만나요</h2>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {USER_FLOW.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center gap-2 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </div>
                  <p className="text-sm font-medium">
                    {i + 1}. {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust & safety */}
        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-center text-2xl font-semibold">안전을 최우선으로</h2>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {TRUST_SAFETY.map((item) => (
                <li key={item.text} className="flex items-center gap-3 rounded-xl border bg-background p-4">
                  <item.icon className="size-5 shrink-0 text-primary" />
                  <span className="text-sm">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t py-20">
          <div className="mx-auto flex max-w-xl flex-col items-center px-4 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">이제 당신의 차례입니다.</h2>
            <p className="mt-4 whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {FINAL_CTA_BODY}
            </p>
            <Button size="lg" className="mt-8" nativeButton={false} render={<Link href={primaryHref} />}>
              파티 둘러보기
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}
