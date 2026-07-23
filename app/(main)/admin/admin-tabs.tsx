import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AdminTabs({ active }: { active: "reports" | "users" }) {
  return (
    <div className="flex gap-2 border-b pb-3">
      <Button
        size="sm"
        variant={active === "reports" ? "default" : "ghost"}
        nativeButton={false}
        render={<Link href="/admin" />}
      >
        신고 / 게임 제안
      </Button>
      <Button
        size="sm"
        variant={active === "users" ? "default" : "ghost"}
        nativeButton={false}
        render={<Link href="/admin/users" />}
      >
        회원
      </Button>
    </div>
  );
}
