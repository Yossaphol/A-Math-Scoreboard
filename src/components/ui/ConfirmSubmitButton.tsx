"use client";

import { useRef, useState } from "react";
import { buttonBase, SIZES, VARIANTS, type Size, type Variant } from "./Button";

/**
 * A submit button for a Server Action `<form>` that shows a confirmation dialog first —
 * spec §13/§18 call for a confirmation step before destructive/consequential actions
 * (Withdraw, Remove, Revoke, Cancel Pairing, etc). Must live inside the target `<form>`.
 */
export function ConfirmSubmitButton({
  label,
  confirmTitle,
  confirmMessage,
  variant = "danger",
  size = "sm",
  className = "",
}: {
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          formRef.current = e.currentTarget.form;
          setOpen(true);
        }}
        className={`${buttonBase} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="surface w-full max-w-sm rounded-2xl p-6">
            <p className="text-sm font-semibold text-neutral-900">{confirmTitle}</p>
            <p className="mt-1.5 text-sm text-neutral-600">{confirmMessage}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${buttonBase} ${VARIANTS.ghost} ${SIZES.sm}`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                className={`${buttonBase} ${VARIANTS[variant]} ${SIZES.sm}`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
