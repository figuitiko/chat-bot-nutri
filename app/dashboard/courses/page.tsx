import Link from "next/link";

import {
  activateCourseAction,
  archiveCourseAction,
  createCourseAction,
} from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          {courses.map((course) => (
            <Link
              key={course.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              href={`/dashboard/courses/${course.id}`}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/courses/${course.id}`}
                    className="font-semibold text-slate-950 hover:text-emerald-700"
                  >
                    {course.name}
                  </Link>
                  {course.isActive ? (
                    <Badge variant="success">Activo</Badge>
                  ) : null}
                  <Badge>{course.status}</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  {course.description ?? "Sin descripcion"}
                </p>
                <p className="text-xs text-slate-500">
                  Modulos: {course.modules.length} · Pasos:{" "}
                  {course.modules.reduce(
                    (sum, module) => sum + module.steps.length,
                    0,
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!course.isActive ? (
                  <form action={activateCourseAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <Button type="submit" size="sm">
                      Activar
                    </Button>
                  </form>
                ) : null}
                <form action={archiveCourseAction}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Archivar
                  </Button>
                </form>
              </div>
            </Link>
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
          <form action={createCourseAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="curso-nuevo" />
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
            <Button className="w-full" type="submit">
              Crear curso
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
