"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

const MIN_LENGTH = 12;

export function AccountSection({ email }: { email: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < MIN_LENGTH) return setMsg({ ok: false, text: `Use at least ${MIN_LENGTH} characters.` });
    if (pw !== pw2) return setMsg({ ok: false, text: "Passwords don't match." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Password changed. Share the new password with staff who need it." });
  }

  async function signOut(scope: "local" | "global") {
    if (scope === "global" && !window.confirm("Sign out every device using the shared login, including this one?")) return;
    setBusy(true);
    await createClient().auth.signOut({ scope });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <section className="mt-12 space-y-6 border-t border-line pt-8 pb-10">
      <h2 className="text-[18px] font-medium text-garnet-deep">Shared login</h2>
      <p className="text-[14px] text-muted">Signed in as {email}</p>
      <form onSubmit={changePassword} className="space-y-3">
        <label htmlFor="new-pw" className="mb-2 block text-[13px] font-medium tracking-[0.08em] text-ink-soft uppercase">
          Change password
        </label>
        <input id="new-pw" type="password" autoComplete="new-password" placeholder="New password (12+ characters)" className="field" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input
          type="password"
          aria-label="Confirm new password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          className="field"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`text-[14px] ${msg.ok ? "text-[#2F5320]" : "text-error"}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" className="btn btn-outline" disabled={busy}>
          Update password
        </button>
      </form>
      <div className="space-y-3 border-t border-line pt-6">
        <p className="text-[14px] text-ink-soft">
          When a staff member leaves: change the password, then sign out all devices.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void signOut("local")}>
            Sign out
          </button>
          <button type="button" className="btn border border-error text-error" disabled={busy} onClick={() => void signOut("global")}>
            Sign out all devices
          </button>
        </div>
      </div>
    </section>
  );
}
