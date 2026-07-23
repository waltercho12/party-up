import Link from "next/link";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { Button } from "@/components/ui/button";
import { SupportTicketForm } from "./support-ticket-form";

export default async function SupportPage() {
  const { user, profile } = await getCurrentProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">고객지원</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          질문, 버그 제보, 기능 제안, 불만사항까지 무엇이든 편하게 보내주세요. 운영진이 확인 후
          답변드릴게요.
        </p>
      </div>

      {user && profile && (
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/my/support" />}>
          내 문의 내역 보기
        </Button>
      )}

      <SupportTicketForm
        userId={user?.id ?? null}
        initialEmail={user?.email ?? ""}
      />
    </div>
  );
}
