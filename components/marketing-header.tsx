import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/get-current-profile";

export async function MarketingHeader() {
  const { user, profile } = await getCurrentProfile();
  const primaryHref = user && profile ? "/parties" : "/login";

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-1">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Party-up
          </Link>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/about" />}>
            Party-up이란?
          </Button>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/support" />}>
            고객지원
          </Button>
          <Button nativeButton={false} render={<Link href={primaryHref} />}>
            {user && profile ? "파티 탐색" : "시작하기"}
          </Button>
        </nav>
      </div>
    </header>
  );
}
