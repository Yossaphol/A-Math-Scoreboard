"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/dal";
import { logAdminAction } from "@/lib/audit-log";
import { setFlash } from "@/lib/flash";
import { saveSystemSettings } from "@/lib/system-settings";

export async function setLiveFeedEnabled(formData: FormData) {
  const admin = await assertAdmin();
  const enabled = formData.get("enabled") === "1";

  await saveSystemSettings({ liveFeedEnabled: enabled });
  await logAdminAction({
    actorId: admin.id,
    action: enabled ? "settings.live_feed_on" : "settings.live_feed_off",
    summary: enabled ? "เปิดระบบแจ้งเตือนสด" : "ปิดระบบแจ้งเตือนสด",
    targetType: "SystemSetting",
  });
  await setFlash({ type: "success", title: enabled ? "เปิดระบบแจ้งเตือนสดแล้ว" : "ปิดระบบแจ้งเตือนสดแล้ว" });

  // Every layout reads the switch (admin shell, public site, table pages).
  revalidatePath("/", "layout");
}

export async function setShowWithdrawn(formData: FormData) {
  const admin = await assertAdmin();
  const scope = formData.get("scope") === "public" ? "public" : "admin";
  const show = formData.get("show") === "1";
  const where = scope === "public" ? "หน้า User" : "หน้า Admin";

  await saveSystemSettings(scope === "public" ? { showWithdrawnPublic: show } : { showWithdrawnAdmin: show });
  await logAdminAction({
    actorId: admin.id,
    action: `settings.withdrawn_${scope}_${show ? "shown" : "hidden"}`,
    summary: `${show ? "แสดง" : "ซ่อน"}ผู้เล่นที่ถอนตัวใน${where}`,
    targetType: "SystemSetting",
  });
  await setFlash({ type: "success", title: `${show ? "แสดง" : "ซ่อน"}ผู้เล่นที่ถอนตัวใน${where}แล้ว` });

  revalidatePath("/", "layout");
}
