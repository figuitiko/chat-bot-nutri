import Link from "next/link";

import {
  activateCourseAction,
  archiveCourseAction,
  createCourseAction,
} from "@/app/dashboard/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await db.course.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      modules: {
        include: {
          steps: true,
        },
      },
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Cursos</CardTitle>
          <CardDescription>
            Solo un curso puede estar activo para nuevas conversaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {courses.length === 0 ? (
            <EmptyState
              eyebrow="Cursos"
              title="Aun no tienes cursos creados"
              description="Crea el primer curso desde este panel y luego agregale modulos, pasos, assets y evaluaciones."
            />
          ) : null}

          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/courses/${course.id}`}
                    className="font-semibold text-slate-950 hover:text-emerald-700"
                  >
                    {course.name}
                  </Link>
                  {course.isActive ? <Badge variant="success">Activo</Badge> : null}
                  <Badge>{course.status}</Badge>
                </div>
                <p className="text-sm text-slate-600">{course.description ?? "Sin descripcion"}</p>
                <p className="text-xs text-slate-500">
                  Modulos: {course.modules.length} · Pasos:{" "}
                  {course.modules.reduce((sum, module) => sum + module.steps.length, 0)}
                </p>
                <Link
                  href={`/dashboard/courses/${course.id}`}
                  className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-600"
                >
                  Abrir editor
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {!course.isActive ? (
                  <form action={activateCourseAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <SubmitButton size="sm" pendingText="Activando...">
                      Activar
                    </SubmitButton>
                  </form>
                ) : null}
                <form action={archiveCourseAction}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <SubmitButton size="sm" variant="outline" pendingText="Archivando...">
                    Archivar
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear curso</CardTitle>
          <CardDescription>
            Arranca un curso nuevo en modo borrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCourseAction} className="space-y-4" aria-describedby="course-create-help">
            <p id="course-create-help" className="text-sm text-slate-500">
              El curso se crea en borrador y despues puedes subir portada, armar modulos y activar la version final.
            </p>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" autoComplete="off" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="curso-nuevo" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea id="description" name="description" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado inicial</Label>
              <Select id="status" name="status" defaultValue="DRAFT">
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </Select>
            </div>
            <SubmitButton className="w-full" pendingText="Creando...">
              Crear curso
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
