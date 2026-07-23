import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/get-current-profile";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { user, profile } = await getCurrentProfile();

  if (!user) redirect("/login");
  if (profile) redirect("/parties");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">프로필을 만들어주세요</h1>
      <p className="mb-8 mt-2 text-muted-foreground">
        닉네임만 있으면 5분 안에 함께할 사람을 찾을 수 있어요.
      </p>
      <OnboardingForm userId={user.id} />
    </main>
  );
}
