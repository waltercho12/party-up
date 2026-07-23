import { requireAdmin } from "@/lib/require-admin";
import { getReputationTier } from "@/lib/reputation";
import { ProfileChip } from "@/components/profile-chip";
import { AdminTabs } from "../admin-tabs";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url, bio, created_at")
    .order("created_at", { ascending: false });

  const users = await Promise.all(
    (profiles ?? []).map(async (p) => ({
      ...p,
      tier: await getReputationTier(supabase, p.id),
    }))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">관리자</h1>
        <p className="mt-1 text-sm text-muted-foreground">가입한 사용자의 프로필을 확인하세요.</p>
      </div>

      <AdminTabs active="users" />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">회원 ({users.length})</h2>
        {users.length > 0 ? (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <ProfileChip userId={u.id} nickname={u.nickname} avatarUrl={u.avatar_url} tier={u.tier} />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(u.created_at)} 가입
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">가입한 사용자가 없어요.</p>
        )}
      </section>
    </div>
  );
}
