import Link from "next/link";

import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await requireAdminSession();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">WhatsApp Course Studio</p>
            <h1 className="text-xl font-semibold">Dashboard de cursos</h1>
          </div>
          <nav className="flex items-center gap-3">
            <Link className="text-sm text-slate-600 hover:text-slate-950" href="/dashboard">
              Resumen
            </Link>
            <Link className="text-sm text-slate-600 hover:text-slate-950" href="/dashboard/courses">
              Cursos
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                Salir ({admin.name})
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
