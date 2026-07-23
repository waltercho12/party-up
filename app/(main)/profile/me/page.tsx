import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { EditProfileForm } from "./edit-profile-form";

export default async function MyProfilePage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">내 프로필</h1>
      <p className="mb-8 mt-2 text-sm text-muted-foreground">
        다른 사람에게 보여지는 정보를 관리하세요.
      </p>
      <EditProfileForm
        userId={user.id}
        initialNickname={profile.nickname}
        initialAvatarUrl={profile.avatar_url}
        initialBio={profile.bio}
      />
    </div>
  );
}
