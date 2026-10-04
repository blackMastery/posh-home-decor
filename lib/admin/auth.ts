import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export class NotAdminError extends Error {
  constructor() {
    super("Not authorised");
  }
}

/** Returns the cookie client + user if the caller is the admin; otherwise null. */
export async function getAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return null;
  return { supabase, user };
}

/** For pages: redirect to login when not an admin. */
export async function requireAdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions: never trust the proxy alone. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new NotAdminError();
  return admin;
}
