import Link from "next/link";

import { logoutAction } from "@/app/login/actions";
import { SubmitButton } from "@/components/dashboard/submit-button";
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
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-700">WhatsApp Course Studio</p>
            <h1 className="text-xl font-semibold">Dashboard de cursos</h1>
          </div>
          <nav
            aria-label="Navegacion principal del dashboard"
            className="flex flex-wrap items-center gap-2 sm:gap-3"
          >
            <Link
              className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              href="/dashboard"
            >
              Resumen
            </Link>
            <Link
              className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              href="/dashboard/courses"
            >
              Cursos
            </Link>
            <Link
              className="rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              href="/dashboard/contacts"
            >
              Contactos
            </Link>
            <form action={logoutAction}>
              <SubmitButton variant="outline" pendingText="Saliendo...">
                Salir ({admin.name})
              </SubmitButton>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
