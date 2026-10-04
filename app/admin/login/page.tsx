import type { Metadata } from "next";
import { Logo } from "@/components/store/logo";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-10 text-center text-[22px] font-medium text-garnet-deep">Staff sign in</h1>
        <LoginForm />
      </div>
    </main>
  );
}
