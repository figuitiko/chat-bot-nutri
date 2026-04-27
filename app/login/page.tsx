import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dcfce7,_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eefbf4_100%)] p-6">
      <Card className="w-full max-w-md border-emerald-100 shadow-xl shadow-emerald-950/5">
        <CardHeader>
          <CardTitle>Ingreso al dashboard</CardTitle>
          <CardDescription>
            Administra cursos, modulos, pasos, evaluaciones y assets del bot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
