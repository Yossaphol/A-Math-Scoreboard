"use client";

import { useEffect } from "react";
import type { Flash } from "@/lib/flash";
import { showAlert } from "./store";

// Each flash carries its own id, so remembering which ones were already shown keeps a dev
// double-effect or a re-render of the same server payload from raising it twice.
const shown = new Set<string>();

/** Hands a Server Action's one-shot flash cookie (see lib/flash.ts) to the alert stack. */
export function FlashReceiver({ flash }: { flash: Flash & { id: string } }) {
  useEffect(() => {
    // Non-httpOnly by design — clear it now so a later client-side navigation that doesn't
    // re-run a Server Action won't replay this alert.
    document.cookie = "flash=; Max-Age=0; path=/";
    if (shown.has(flash.id)) return;
    shown.add(flash.id);
    const { id, key, ...alert } = flash;
    showAlert({ ...alert, id: key ?? id });
  }, [flash]);

  return null;
}
