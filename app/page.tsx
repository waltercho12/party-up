import Link from "next/link";
import { Heart, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { MarketingHeader } from "@/components/marketing-header";

const PRINCIPLES = [
  {
    icon: Heart,
    title: "사람이 게임보다 중요하다",
    body: "게임은 콘텐츠이고, 사람은 서비스의 핵심이에요.",
  },
  {
    icon: ShieldCheck,
    title: "신뢰는 행동으로 만들어진다",
    body: "좋은 평판은 꾸준한 행동의 결과예요. 하루아침에 쌓이지 않아요.",
  },
  {
    icon: Sparkles,
    title: "경쟁보다 경험",
    body: "Party-up의 기록은 경쟁의 증거가 아니라 추억의 기록이에요.",
  },
];

export default async function Home() {
  const { user, profile } = await getCurrentProfile();
  const primaryHref = user && profile ? "/parties" : "/login";

  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            같이 게임할 사람은 많다.
            <br />
            믿고 같이 할 사람은 적다.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-muted-foreground sm:text-lg">
            나이, 성별, 게임의 유명세와 관계없이 누구나 믿고 함께 게임할 사람을 쉽게 찾을 수
            있는 게임 문화를 만들어요.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
              파티 탐색 시작하기
            </Button>
            {!(user && profile) && (
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/login" />}>
                로그인
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            실행 후 5분 안에, 믿고 함께 게임할 사람을 찾을 수 있어요.
          </p>
        </section>

        {/* Definition */}
        <section className="border-t bg-primary/5 py-16">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <p className="text-balance text-lg font-medium leading-relaxed sm:text-2xl">
              Party-up은 단순 게임 매칭 서비스가 아니에요.
              <br />
              <span className="text-primary">믿고 함께 게임할 사람을 찾는 플랫폼</span>이에요.
            </p>
            <p className="mt-6 text-pretty text-sm text-muted-foreground sm:text-base">
              5분 안에 다양한 게임을 함께할, 믿을 수 있는 사람을 연결하는 것 — 그게 저희
              미션이에요.
            </p>
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-t py-16">
          <div className="mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-2xl font-semibold">이런 분들을 위해 만들었어요</h2>
            <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              혼자 게임하지만, 새로운 사람과 함께하는 게 싫진 않은 분. 실력보다{" "}
              <strong className="text-foreground">함께하기 좋은 사람</strong>을 찾는 분을 위해
              만들었어요.
            </p>
          </div>
        </section>

        {/* Core principles */}
        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-2xl font-semibold">우리가 지키는 원칙</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {PRINCIPLES.map((principle) => (
                <Card key={principle.title}>
                  <CardHeader>
                    <principle.icon className="size-5 text-primary" />
                    <CardTitle className="mt-2 text-base">{principle.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                      {principle.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center px-4 text-center">
            <h2 className="text-2xl font-semibold">지금, 믿고 함께할 사람을 찾아보세요</h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" nativeButton={false} render={<Link href={primaryHref} />}>
                파티 탐색 시작하기
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/about" />}>
                Party-up 더 알아보기
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
