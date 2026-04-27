"use server";

import { redirect } from "next/navigation";

import { authenticateAdmin, clearAdminSession } from "@/lib/admin-auth";
import { AppError } from "@/lib/http";

export async function loginAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await authenticateAdmin(email, password);
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Error inesperado. Intentá de nuevo.";
    return { error: message };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
