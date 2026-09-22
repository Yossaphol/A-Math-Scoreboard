"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// Without this, any thrown error on this page (e.g. a stale device resubmitting an
// already-confirmed match) crashed to the browser's bare "This page couldn't load" instead
// of something a player at the table can actually act on.
export default function TableError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Card className="text-center">
        <p className="text-sm font-medium text-neutral-900">เกิดข้อผิดพลาด</p>
        <p className="mt-1 text-xs text-neutral-500">{error.message || "กรุณาลองใหม่อีกครั้ง"}</p>
        <Button type="button" onClick={() => reset()} className="mt-4">
          ลองใหม่
        </Button>
      </Card>
    </main>
  );
}
