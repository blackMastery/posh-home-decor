import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { fetchInquiries, parseRange } from "@/lib/admin/inquiries";
import { InquiryList } from "@/components/admin/inquiry-list";

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage({ searchParams }: PageProps<"/admin/inquiries">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const range = parseRange(sp.range);
  const items = await fetchInquiries(supabase, { q, range }, 0);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="text-[26px] font-medium text-garnet-deep">Inquiries</h1>
      <p className="mt-1 text-[14px] text-muted">Orders sent from the website. Match chats by reference.</p>
      <InquiryList key={`${q}|${range}`} initial={items} q={q} range={range} />
    </div>
  );
}
