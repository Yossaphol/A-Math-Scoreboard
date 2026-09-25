"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { buttonBase, SIZES, VARIANTS } from "@/components/ui/Button";

/**
 * Spec §13: before a result is sent, show exactly what will be recorded (who won, the score)
 * so a mis-tapped winner or a typo is caught here rather than becoming a Score Conflict.
 *
 * Portaled to <body>: the result form is a `.surface` card, whose backdrop-filter would
 * otherwise make this `position: fixed` overlay size itself to the card instead of the
 * screen. The confirm button stays tied to the form through its `form` attribute.
 */
export function ResultConfirmDialog({
  formId,
  onCancel,
  children,
}: {
  formId: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Focus the primary action on open, and hand focus back to whatever opened the popup
  // (the form's submit button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Opaque, unlike other .surface cards: the page behind shouldn't show through the
          one thing the player must read carefully before confirming. */}
      <div className="surface w-full max-w-sm rounded-2xl !bg-white p-6">
        <p id={titleId} className="text-sm font-semibold text-neutral-900">
          ยืนยันผลการแข่งขัน?
        </p>
        <p className="mt-1 text-xs text-neutral-500">ตรวจสอบผู้ชนะและคะแนนให้ถูกต้องก่อนส่ง</p>
        <div className="mt-4">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={`${buttonBase} ${VARIANTS.secondary} ${SIZES.md}`}>
            กลับไปแก้
          </button>
          <button
            ref={confirmRef}
            type="submit"
            form={formId}
            className={`${buttonBase} ${VARIANTS.primary} ${SIZES.md}`}
          >
            ยืนยันส่งผล
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
