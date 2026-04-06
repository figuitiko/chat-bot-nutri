import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [activeCourse, courseCount, openConversations, contactCount, enrollmentCount] = await Promise.all([
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
    db.contact.count(),
    db.courseEnrollment.count({
      where: {
        isActive: true,
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
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Curso activo</p>
            <p className="mt-1 text-lg font-semibold">{activeCourse?.name ?? "Sin activar"}</p>
            {activeCourse?.isActive ? (
              <Badge className="mt-2" variant="success">
                Activo
              </Badge>
            ) : null}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Cursos cargados</p>
            <p className="mt-1 text-lg font-semibold">{courseCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Conversaciones abiertas</p>
            <p className="mt-1 text-lg font-semibold">{openConversations}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Contactos registrados</p>
            <p className="mt-1 text-lg font-semibold">{contactCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Inscripciones activas</p>
            <p className="mt-1 text-lg font-semibold">{enrollmentCount}</p>
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
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/dashboard/courses/${activeCourse.id}`}>Abrir editor del curso activo</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/contacts">Gestionar contactos y accesos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          eyebrow="Siguiente paso"
          title="Todavia no hay un curso activo"
          description="Activa uno de tus cursos para que los nuevos learners puedan entrar al flujo correcto desde WhatsApp."
          actionHref="/dashboard/courses"
          actionLabel="Ir a cursos"
        />
      )}
    </div>
  );
}
