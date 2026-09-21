import "server-only";
import { cookies } from "next/headers";

export type FlashType = "success" | "error";

// A short-lived, non-httpOnly cookie carrying a one-shot toast message across the redirect
// or revalidation a Server Action triggers. Not sensitive data, so the client is allowed to
// read + clear it directly (see FlashToastHost/Toast) without another round trip.
export async function setFlash(message: string, type: FlashType = "success") {
  const store = await cookies();
  store.set("flash", JSON.stringify({ message, type }), {
    maxAge: 10,
    path: "/",
    httpOnly: false,
  });
}
