import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AdminTabs({ active }: { active: "reports" | "users" | "support" }) {
  return (
    <div className="flex flex-wrap gap-2 border-b pb-3">
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
      <Button
        size="sm"
        variant={active === "support" ? "default" : "ghost"}
        nativeButton={false}
        render={<Link href="/admin/support" />}
      >
        Support
      </Button>
    </div>
  );
}
