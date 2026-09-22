import { redirect } from "next/navigation";

// Match history now lives directly on /account (no extra click-through) — this route stays
// only so old links/bookmarks still land somewhere.
export default function AccountHistoryRedirect() {
  redirect("/account");
}
