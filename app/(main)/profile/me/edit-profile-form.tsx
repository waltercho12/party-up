"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function EditProfileForm({
  userId,
  initialNickname,
  initialAvatarUrl,
  initialBio,
}: {
  userId: string;
  initialNickname: string;
  initialAvatarUrl: string | null;
  initialBio: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(initialNickname);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("5MB 이하의 이미지만 업로드할 수 있어요.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      toast.error("이미지 업로드에 실패했어요: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: nickname.trim(),
        avatar_url: avatarUrl.trim() || null,
        bio: bio.trim() || null,
      })
      .eq("id", userId);
    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 사용 중인 닉네임이에요.");
      } else {
        toast.error("저장에 실패했어요: " + error.message);
      }
      return;
    }

    toast.success("프로필을 저장했어요.");
    router.push(`/profile/${userId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>프로필 이미지</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl || undefined} alt={nickname} />
            <AvatarFallback className="text-lg">{nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "업로드 중..." : "사진 변경"}
          </Button>
        </div>
      </div>
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
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">자기소개</Label>
          <span className="text-xs text-muted-foreground">{bio.length}/100</span>
        </div>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 100))}
          maxLength={100}
          placeholder="퇴근 후 즐겜 유저입니다 😊 실력보다 매너를 중요하게 생각해요."
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading || uploading}>
        저장하기
      </Button>
    </form>
  );
}
