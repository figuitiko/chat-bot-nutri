import {
  assignCourseEnrollmentAction,
  deleteContactAction,
  revokeCourseEnrollmentAction,
  setContactSecretAction,
  updateContactAction,
} from "@/app/dashboard/actions";
import { DeleteConfirmButton } from "@/components/dashboard/delete-confirm-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const [contact, courses] = await Promise.all([
    db.contact.findUnique({
      where: { id: contactId },
      include: {
        accessCredential: true,
        enrollments: {
          include: {
            course: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    db.course.findMany({
      where: {
        status: {
          in: ["DRAFT", "ACTIVE"],
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{contact.name || contact.profileName || contact.phone}</CardTitle>
              <CardDescription>
                Configura la clave de acceso del contacto y los cursos que puede seleccionar desde
                WhatsApp.
              </CardDescription>
            </div>
            <DeleteConfirmButton
              action={deleteContactAction}
              message={`¿Eliminar a "${contact.name || contact.phone}" y todos sus datos? Esta acción no se puede deshacer.`}
              hiddenFields={{ contactId: contact.id }}
            >
              Eliminar contacto
            </DeleteConfirmButton>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form action={updateContactAction} className="space-y-4" aria-describedby="contact-detail-help">
            <input type="hidden" name="contactId" value={contact.id} />
            <p id="contact-detail-help" className="text-sm text-slate-500">
              Usa el mismo telefono con el que el learner escribe al bot para que la validacion de acceso funcione sin friccion.
            </p>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" name="phone" defaultValue={contact.phone} inputMode="tel" autoComplete="tel" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" defaultValue={contact.name ?? ""} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileName">Nombre de perfil</Label>
              <Input id="profileName" name="profileName" defaultValue={contact.profileName ?? ""} />
            </div>
            <input name="locale" type="hidden" value={contact.locale} />
            <Button type="submit">Guardar contacto</Button>
          </form>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {contact.accessCredential?.isActive ? (
                <Badge variant="success">Clave activa</Badge>
              ) : (
                <Badge variant="warning">Sin clave activa</Badge>
              )}
              {contact.accessCredential?.lockedUntil ? (
                <Badge variant="destructive">Bloqueado</Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Intentos fallidos: {contact.accessCredential?.failedAttempts ?? 0}
            </p>
            <p className="text-sm text-slate-600">
              Ultima validacion:{" "}
              {contact.accessCredential?.lastVerifiedAt
                ? contact.accessCredential.lastVerifiedAt.toLocaleString("es-MX")
                : "Nunca"}
            </p>
          </div>

          <form
            action={setContactSecretAction}
            className="space-y-4 rounded-2xl border border-slate-200 p-4"
            aria-describedby="secret-help"
          >
            <input type="hidden" name="contactId" value={contact.id} />
            <p id="secret-help" className="text-sm text-slate-500">
              La clave se almacena con hash y sirve para desbloquear el menu de cursos disponibles.
            </p>
            <div className="space-y-2">
              <Label htmlFor="secret">Nueva clave secreta</Label>
              <Input id="secret" name="secret" minLength={6} autoComplete="new-password" required />
            </div>
            <Button type="submit">Guardar o resetear clave</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cursos asignados</CardTitle>
          <CardDescription>
            Si el contacto tiene varios cursos activos, el bot mostrara un selector despues de
            validar la clave.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {contact.enrollments.length === 0 ? (
            <EmptyState
              eyebrow="Inscripciones"
              title="Este contacto aun no tiene cursos asignados"
              description="Asigna uno o varios cursos activos o en borrador. Si hay varios, el bot mostrara un selector despues de validar la clave."
            />
          ) : null}
          {contact.enrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-950">{enrollment.course.name}</span>
                  {enrollment.isActive ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>}
                  {enrollment.course.isActive ? <Badge>Curso publicado</Badge> : null}
                </div>
                <p className="text-sm text-slate-600">{enrollment.course.slug}</p>
              </div>
              {enrollment.isActive ? (
                <form action={revokeCourseEnrollmentAction}>
                  <input type="hidden" name="contactId" value={contact.id} />
                  <input type="hidden" name="enrollmentId" value={enrollment.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Revocar acceso
                  </Button>
                </form>
              ) : null}
            </div>
          ))}

          <form action={assignCourseEnrollmentAction} className="grid gap-3 rounded-2xl bg-slate-50 p-4">
            <input type="hidden" name="contactId" value={contact.id} />
            <Label htmlFor="courseId">Asignar curso</Label>
            <Select id="courseId" name="courseId" defaultValue="">
              <option value="" disabled>
                Selecciona un curso
              </option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.status})
                </option>
              ))}
            </Select>
            <p className="text-sm text-slate-500">
              Solo los cursos asignados apareceran para este learner cuando escriba la clave correcta.
            </p>
            <Button type="submit">Asignar curso</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
