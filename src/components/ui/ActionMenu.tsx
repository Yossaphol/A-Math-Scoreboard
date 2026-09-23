"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Row-action "⋯" menu — replaces a row of small buttons (which gets cluttered once a row
 * can have 2-3 possible actions) with a single trigger. Renders its panel through a portal
 * into <body>, positioned by the trigger's own screen coordinates, so it's never clipped by
 * an ancestor table wrapper's `overflow-x-auto` (per the CSS overflow spec, once either axis
 * on a container isn't `visible`, the other axis effectively becomes `auto` too — so a plain
 * `position: absolute` dropdown inside such a wrapper can get cut off vertically).
 */
export function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-black/5"
      >
        <span aria-hidden className="text-lg leading-none">
          ⋯
        </span>
        <span className="sr-only">เปิดเมนู</span>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ position: "fixed", top: position.top, right: position.right }}
            className="z-50 flex min-w-[11rem] flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
