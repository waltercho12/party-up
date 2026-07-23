import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";

export async function SiteHeader() {
  const { user, profile } = await getCurrentProfile();

  let isAdmin = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("is_admin");
    isAdmin = !!data;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
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
          <Button variant="ghost" nativeButton={false} render={<Link href="/parties" />}>
            파티 탐색
          </Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/parties/new" />}>
            모집글 작성
          </Button>
          {user && profile ? (
            <>
              {isAdmin && (
                <Button variant="ghost" nativeButton={false} render={<Link href="/admin" />}>
                  관리자
                </Button>
              )}
              <NotificationBell userId={user.id} />
              <UserMenu nickname={profile.nickname} avatarUrl={profile.avatar_url} />
            </>
          ) : (
            <Button nativeButton={false} render={<Link href="/login" />}>
              로그인
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
