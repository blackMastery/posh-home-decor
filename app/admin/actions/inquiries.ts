"use server";

import { requireAdmin } from "@/lib/admin/auth";
import { fetchInquiries, type InquiryFilter, type InquiryListItem } from "@/lib/admin/inquiries";

export async function loadInquiries(filter: InquiryFilter, offset: number): Promise<InquiryListItem[]> {
  const { supabase } = await requireAdmin();
  return fetchInquiries(supabase, filter, offset);
}
