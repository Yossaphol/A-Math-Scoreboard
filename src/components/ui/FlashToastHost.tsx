import { cookies } from "next/headers";
import { FlashReceiver } from "./alerts/FlashReceiver";
import type { Flash } from "@/lib/flash";

export async function FlashToastHost() {
  const store = await cookies();
  const raw = store.get("flash")?.value;
  if (!raw) return null;

  let parsed: (Flash & { id: string }) | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed?.id || !parsed.title) return null;

  return <FlashReceiver flash={parsed} />;
}
