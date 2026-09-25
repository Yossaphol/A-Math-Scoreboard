"use client";

import { useId, useRef, useState, type FormEvent } from "react";

/**
 * Spec §13's two-step submit, shared by both result forms: the first submit validates and
 * opens the confirmation popup (ResultConfirmDialog) instead of sending anything; the popup's
 * confirm button submits the same form again, which is then let through — exactly once, so
 * a double tap on confirm can't send the result twice.
 */
export function useConfirmBeforeSubmit(validate: () => string | null) {
  const formId = useId();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const message = validate();
    if (message) {
      e.preventDefault();
      setError(message);
      setConfirming(false);
      return;
    }
    setError(null);

    if (!confirming) {
      e.preventDefault();
      sentRef.current = false;
      setConfirming(true);
      return;
    }
    if (sentRef.current) {
      e.preventDefault();
      return;
    }
    sentRef.current = true;
    setConfirming(false);
  }

  return { formId, confirming, error, onSubmit, cancel: () => setConfirming(false) };
}
