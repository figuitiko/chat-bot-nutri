"use server";

import { redirect } from "next/navigation";

import { authenticateAdmin, clearAdminSession } from "@/lib/admin-auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  await authenticateAdmin(email, password);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}
