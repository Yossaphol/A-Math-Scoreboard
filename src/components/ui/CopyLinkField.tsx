"use client";

import { useState } from "react";

/** A one-line, ellipsized link with Copy and Open-in-new-tab buttons. */
export function CopyLinkField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, permissions) — the link is still selectable.
    }
  }

  const iconButton =
    "inline-flex h-7 shrink-0 items-center justify-center rounded-md px-2 text-[11px] font-medium text-neutral-600 hover:bg-black/5 hover:text-neutral-900";

  return (
    <div className="flex w-full min-w-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white/70 py-0.5 pl-2.5 pr-0.5">
      <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-500" title={url}>
        {url}
      </span>
      <button type="button" onClick={copy} className={iconButton} aria-label="คัดลอกลิงก์">
        {copied ? "คัดลอกแล้ว" : "Copy"}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className={iconButton} aria-label="เปิดลิงก์ในแท็บใหม่">
        เปิด ↗
      </a>
    </div>
  );
}
