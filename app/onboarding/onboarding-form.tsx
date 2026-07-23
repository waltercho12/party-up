"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").insert({
      id: userId,
      nickname: nickname.trim(),
      bio: bio.trim() || null,
    });
    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요.");
      } else {
        toast.error("프로필 생성에 실패했어요: " + error.message);
      }
      return;
    }

    router.replace("/parties");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">한줄 소개 (선택)</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          placeholder="어떤 게임을 좋아하는지, 어떤 스타일로 플레이하는지 자유롭게 적어주세요."
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        시작하기
      </Button>
    </form>
  );
}
