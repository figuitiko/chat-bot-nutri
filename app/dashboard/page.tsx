import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [activeCourse, courseCount, openConversations] = await Promise.all([
    db.course.findFirst({
      where: { isActive: true },
      include: {
        modules: {
          include: {
            steps: true,
          },
        },
      },
    }),
    db.course.count(),
    db.conversation.count({
      where: {
        status: "OPEN",
        courseId: { not: null },
      },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Curso activo para nuevas conversaciones</CardTitle>
          <CardDescription>
            Los nuevos learners arrancan en el curso activo. Las conversaciones ya iniciadas se
            mantienen fijadas al curso con el que comenzaron.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Curso activo</p>
            <p className="mt-1 text-lg font-semibold">{activeCourse?.name ?? "Sin activar"}</p>
            {activeCourse?.isActive ? <Badge className="mt-2" variant="success">Activo</Badge> : null}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Cursos cargados</p>
            <p className="mt-1 text-lg font-semibold">{courseCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Conversaciones abiertas</p>
            <p className="mt-1 text-lg font-semibold">{openConversations}</p>
          </div>
        </CardContent>
      </Card>

      {activeCourse ? (
        <Card>
          <CardHeader>
            <CardTitle>{activeCourse.name}</CardTitle>
            <CardDescription>{activeCourse.description ?? "Sin descripcion"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-slate-600">
              Modulos: {activeCourse.modules.length} · Pasos:{" "}
              {activeCourse.modules.reduce((sum, module) => sum + module.steps.length, 0)}
            </p>
            <Link
              href={`/dashboard/courses/${activeCourse.id}`}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
            >
              Abrir editor del curso activo
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
