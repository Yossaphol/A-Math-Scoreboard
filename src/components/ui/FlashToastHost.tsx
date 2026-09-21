import { cookies } from "next/headers";
import { Toast } from "./Toast";
import type { FlashType } from "@/lib/flash";

export async function FlashToastHost() {
  const store = await cookies();
  const raw = store.get("flash")?.value;
  if (!raw) return null;

  let parsed: { message: string; type: FlashType } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed) return null;

  // Keying on the raw cookie value forces a remount (and re-arm of the auto-hide timer)
  // whenever a new flash message is set, even if the previous one used the same text.
  return <Toast key={raw} message={parsed.message} type={parsed.type} />;
}
