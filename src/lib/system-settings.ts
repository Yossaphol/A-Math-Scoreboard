import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = 1;

export type SystemSettings = {
  liveFeedEnabled: boolean;
  showWithdrawnAdmin: boolean;
  showWithdrawnPublic: boolean;
};

/** System-wide switches (/admin/settings). No row yet = every default (feed on). */
export async function readSystemSettings(): Promise<SystemSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  return {
    liveFeedEnabled: row?.liveFeedEnabled ?? true,
    showWithdrawnAdmin: row?.showWithdrawnAdmin ?? true,
    showWithdrawnPublic: row?.showWithdrawnPublic ?? false,
  };
}

/** Same, read once per request — for pages and layouts. Long-lived streams use readSystemSettings. */
export const getSystemSettings = cache(readSystemSettings);

export async function saveSystemSettings(data: Partial<SystemSettings>) {
  await prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}
