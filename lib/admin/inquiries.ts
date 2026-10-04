import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type InquiryRange = "today" | "7d" | "30d" | "all";
export type InquiryFilter = { q: string; range: InquiryRange };
export type InquiryListItem = {
  id: string;
  ref: string;
  customer_name: string;
  item_count: number;
  subtotal: number;
  created_at: string;
};

export const INQUIRY_PAGE = 30;

export function parseRange(v: unknown): InquiryRange {
  return v === "today" || v === "7d" || v === "30d" ? v : "all";
}

function since(range: InquiryRange) {
  const now = new Date();
  if (range === "today") {
    // Guyana is UTC-4 with no DST.
    const gy = new Date(now.getTime() - 4 * 3600_000);
    gy.setUTCHours(0, 0, 0, 0);
    return new Date(gy.getTime() + 4 * 3600_000).toISOString();
  }
  if (range === "7d") return new Date(now.getTime() - 7 * 86400_000).toISOString();
  if (range === "30d") return new Date(now.getTime() - 30 * 86400_000).toISOString();
  return null;
}

export async function fetchInquiries(
  supabase: SupabaseClient<Database>,
  filter: InquiryFilter,
  offset: number,
): Promise<InquiryListItem[]> {
  let query = supabase
    .from("inquiries")
    .select("id, ref, customer_name, item_count, subtotal, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + INQUIRY_PAGE - 1);

  const from = since(filter.range);
  if (from) query = query.gte("created_at", from);

  const q = filter.q.trim().slice(0, 60);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const safe = q.replace(/[%_\\,()]/g, " ");
    const ors = [`customer_name.ilike.%${safe}%`];
    if (/^(ph-?)?\d{1,5}$/i.test(q)) ors.push(`ref.ilike.%${digits}%`);
    if (digits.length >= 4) ors.push(`phone_e164.ilike.%${digits}%`);
    query = query.or(ors.join(","));
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
