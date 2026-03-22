import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/admin-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/app/login/actions";

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
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button className="w-full" type="submit">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
