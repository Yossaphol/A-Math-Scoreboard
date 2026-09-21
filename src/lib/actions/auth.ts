"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

function safeCallback(raw: FormDataEntryValue | null): string {
  // Only ever redirect to a same-site path — never let a form field send someone off-site.
  if (typeof raw === "string" && raw.startsWith("/")) return raw;
  return "/admin";
}

export async function loginAction(formData: FormData) {
  const redirectTo = safeCallback(formData.get("callbackUrl"));
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(redirectTo)}`);
    }
    throw error;
  }
}

export async function googleLoginAction(formData: FormData) {
  const redirectTo = safeCallback(formData.get("callbackUrl"));
  await signIn("google", { redirectTo });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
