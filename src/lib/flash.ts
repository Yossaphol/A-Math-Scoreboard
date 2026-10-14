import "server-only";
import { cookies } from "next/headers";

export type FlashType = "success" | "info" | "warning" | "error";

export type Flash = {
  type: FlashType;
  title: string;
  description?: string;
  // Plays the attention chime — reserved for warnings that need a referee to come over.
  sound?: boolean;
  // Alerts sharing a key replace each other on screen — e.g. a match's "results don't match"
  // warning gives way to "confirmed" once the players sort it out.
  key?: string;
  // A match result — hidden from the popup stack (history only) on a device that switched
  // "Popup ผลการแข่ง" off at Settings.
  result?: boolean;
};

// A short-lived, non-httpOnly cookie carrying a one-shot alert across the redirect or
// revalidation a Server Action triggers. Not sensitive data, so the client is allowed to
// read + clear it directly (see FlashToastHost/FlashReceiver) without another round trip.
// The random id makes the same alert raised twice in a row still show twice.
export async function setFlash(flash: Flash) {
  const store = await cookies();
  store.set("flash", JSON.stringify({ ...flash, id: crypto.randomUUID() }), {
    maxAge: 10,
    path: "/",
    httpOnly: false,
  });
}
