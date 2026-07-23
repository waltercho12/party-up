import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Party-up
        </Link>
        <p className="mt-2 text-sm text-muted-foreground">
          같이 게임할 사람은 많다. 믿고 같이 할 사람은 적다.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
