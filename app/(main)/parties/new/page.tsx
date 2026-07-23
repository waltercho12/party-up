import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Button } from "@/components/ui/button";
import { NewPartyForm } from "./new-party-form";

export default async function NewPartyPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();

  const { data: activeParty } = await supabase
    .from("parties")
    .select("id")
    .eq("host_id", user.id)
    .in("status", ["recruiting", "in_progress"])
    .maybeSingle();

  if (activeParty) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">모집글 작성</h1>
        <p className="text-sm text-muted-foreground">
          이미 진행 중인 모집글이 있어요. 한 번에 하나의 파티만 모집할 수 있어요. 기존 파티를
          종료하거나 취소한 뒤 새로 작성해주세요.
        </p>
        <Button nativeButton={false} render={<Link href={`/parties/${activeParty.id}`} />}>
          내 모집글 보러가기
        </Button>
      </div>
    );
  }

  const { data: games } = await supabase
    .from("games")
    .select("id, name, max_party_size")
    .order("name");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">모집글 작성</h1>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">
        어떤 파티를 찾고 있는지 알려주세요.
      </p>
      <NewPartyForm userId={user.id} games={games ?? []} />
    </div>
  );
}
