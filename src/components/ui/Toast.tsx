"use client";

import { useEffect, useState } from "react";
import type { FlashType } from "@/lib/flash";

export function Toast({ message, type }: { message: string; type: FlashType }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Non-httpOnly by design (see lib/flash.ts) — clear it now so a later client-side
    // navigation that doesn't re-run a Server Action won't replay this toast.
    document.cookie = "flash=; Max-Age=0; path=/";
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const color =
    type === "error" ? "border-danger/30 bg-red-50 text-danger" : "border-success/30 bg-emerald-50 text-success";

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${color}`}
      style={{ animation: "toast-in 0.2s ease-out" }}
      role="status"
    >
      {message}
    </div>
  );
}
