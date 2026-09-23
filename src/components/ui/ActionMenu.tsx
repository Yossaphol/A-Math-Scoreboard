"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Placement = { top?: number; bottom?: number; right: number };

/**
 * Row-action "⋯" menu — replaces a row of small buttons (which gets cluttered once a row
 * can have 2-3 possible actions) with a single trigger. Renders its panel through a portal
 * into <body>, positioned by the trigger's own screen coordinates, so it's never clipped by
 * an ancestor table wrapper's `overflow-x-auto` (per the CSS overflow spec, once either axis
 * on a container isn't `visible`, the other axis effectively becomes `auto` too — so a plain
 * `position: absolute` dropdown inside such a wrapper can get cut off vertically).
 *
 * Opens downward by default, but for a trigger near the bottom of the viewport (e.g. the
 * last table row, right above pagination) there may not be room — it's rendered once
 * invisibly to measure its real height, then flips to open upward if it wouldn't fit.
 */
export function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [visible, setVisible] = useState(false);
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

  // Measure the panel's real height once it's mounted (but still invisible), then decide
  // whether it actually fits below the trigger before showing it — avoids a visible jump.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const margin = 8;
    const fitsBelow = rect.bottom + 4 + panelHeight <= window.innerHeight - margin;

    setPlacement(
      fitsBelow
        ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
        : { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
    );
    setVisible(true);
  }, [open]);

  function toggle() {
    if (!open) {
      // Placed off-screen first so the height measurement above never causes a visible flash.
      setPlacement({ top: -9999, right: 0 });
      setVisible(false);
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
        placement &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{
              position: "fixed",
              top: placement.top,
              bottom: placement.bottom,
              right: placement.right,
              visibility: visible ? "visible" : "hidden",
            }}
            className="z-50 flex max-h-[70vh] min-w-[11rem] flex-col gap-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}
