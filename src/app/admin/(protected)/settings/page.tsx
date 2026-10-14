import { requireStaffOrAdmin } from "@/lib/dal";
import { getSystemSettings } from "@/lib/system-settings";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeviceSettings, LiveFeedSetting } from "@/components/admin/SettingsControls";

// Two scopes, kept visibly apart so nobody flips a system switch thinking it's just theirs:
// "เครื่องนี้" (this browser only — Admin and Staff) and "ทั้งระบบ" (every screen — Admin only).
export default async function SettingsPage() {
  const user = await requireStaffOrAdmin();
  const isAdmin = user.role === "ADMIN";
  const { liveFeedEnabled } = await getSystemSettings();

  return (
    <div className="max-w-2xl">
      <PageHeader title="ตั้งค่า" />

      <SettingsSection title="เครื่องนี้" description="มีผลเฉพาะเบราว์เซอร์นี้ บันทึกทันทีที่กด">
        <DeviceSettings liveFeedEnabled={liveFeedEnabled} />
      </SettingsSection>

      {isAdmin && (
        <SettingsSection
          title="ทั้งระบบ"
          description="มีผลกับทุก Tournament และทุกจอ"
          badge={<Badge variant="neutral">Admin</Badge>}
        >
          <LiveFeedSetting enabled={liveFeedEnabled} />
        </SettingsSection>
      )}
    </div>
  );
}

function SettingsSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      </div>
      <Card padding="p-0" className="divide-y divide-neutral-200/70">
        {children}
      </Card>
    </section>
  );
}
