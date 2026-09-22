"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// App-wide fallback — nothing in this app had an error boundary before, so any thrown error
// anywhere (a stale form resubmit, a bad state transition, etc.) crashed straight to the
// browser's bare "This page couldn't load" with no way back in, instead of a page that at
// least offers to retry or go home.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Card className="text-center">
        <p className="text-sm font-medium text-neutral-900">เกิดข้อผิดพลาด</p>
        <p className="mt-1 text-xs text-neutral-500">กรุณาลองใหม่อีกครั้ง หรือกลับไปหน้าแรก</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push("/")}>
            หน้าแรก
          </Button>
          <Button type="button" onClick={() => reset()}>
            ลองใหม่
          </Button>
        </div>
      </Card>
    </main>
  );
}
