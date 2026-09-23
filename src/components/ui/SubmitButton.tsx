"use client";

import { useFormStatus } from "react-dom";
import { Button, type Size, type Variant } from "./Button";

/**
 * Submit button that locks itself while its <form>'s Server Action is running. Without it a
 * slow response invites repeat taps, and each tap re-runs the action — which is how practice
 * players ended up creating the same self-service match five times in under a second.
 * Must be rendered inside the target <form>.
 */
export function SubmitButton({
  children,
  pendingLabel = "กำลังส่ง...",
  variant,
  size,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
