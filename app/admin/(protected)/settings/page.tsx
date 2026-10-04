import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import { SettingsForm } from "@/components/admin/settings-form";
import { AccountSection } from "@/components/admin/account-section";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireAdminPage();
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (!s) throw new Error("Settings row missing");
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <h1 className="text-[26px] font-medium text-garnet-deep">Settings</h1>
      <SettingsForm
        initial={{
          whatsappNumber: s.whatsapp_number,
          displayPhone: s.display_phone,
          heroEyebrow: s.hero_eyebrow,
          heroHeadline: s.hero_headline,
          heroHeadlineAccent: s.hero_headline_accent,
          heroImagePath: s.hero_image_path,
          defaultDetailsText: s.default_details_text,
          defaultCareText: s.default_care_text,
          defaultDeliveryText: s.default_delivery_text,
          newWindowDays: s.new_window_days,
          stylingStudioMessage: s.styling_studio_message,
        }}
      />
      <AccountSection email={user.email ?? ""} />
    </div>
  );
}
