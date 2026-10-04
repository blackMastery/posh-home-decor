import { Suspense } from "react";
import { AdminNav, AdminNavWithPathname } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/admin/auth";

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <>{children}</>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Suspense fallback={<AdminNav pathname="" />}>
        <AdminNavWithPathname />
      </Suspense>
      <main className="flex-1 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
        <Suspense fallback={<AdminLoading />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

function AdminLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8" aria-busy="true">
      <div className="h-8 w-40 animate-pulse bg-sand" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse bg-sand/70" />
        ))}
      </div>
    </div>
  );
}
