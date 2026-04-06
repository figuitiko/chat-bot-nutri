import Link from "next/link";

import { createContactAction } from "@/app/dashboard/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await db.contact.findMany({
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      accessCredential: true,
      enrollments: {
        where: {
          isActive: true,
        },
        include: {
          course: true,
        },
      },
    },
    take: 50,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>Contactos con acceso</CardTitle>
          <CardDescription>
            Cada contacto usa su numero de WhatsApp como identidad y una clave secreta para entrar
            a sus cursos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {contacts.length === 0 ? (
            <EmptyState
              eyebrow="Contactos"
              title="Todavia no hay contactos registrados"
              description="Crea el primer contacto con su numero de WhatsApp y despues asignale cursos y una clave de acceso."
            />
          ) : null}
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/contacts/${contact.id}`}
                    className="font-semibold text-slate-950 hover:text-emerald-700"
                  >
                    {contact.name || contact.profileName || contact.phone}
                  </Link>
                  <Badge>{contact.phone}</Badge>
                  {contact.accessCredential?.isActive ? (
                    <Badge variant="success">Clave activa</Badge>
                  ) : (
                    <Badge variant="warning">Sin clave</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  Cursos activos: {contact.enrollments.map((item) => item.course.name).join(", ") || "Ninguno"}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/contacts/${contact.id}`}>Administrar</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar contacto</CardTitle>
          <CardDescription>Crea o actualiza el contacto que tendra acceso al bot.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createContactAction} className="space-y-4" aria-describedby="contact-create-help">
            <p id="contact-create-help" className="text-sm text-slate-500">
              El telefono se normaliza a formato E.164 y sera la identidad del learner en WhatsApp.
            </p>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+5215512345678"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileName">Nombre de perfil</Label>
              <Input id="profileName" name="profileName" />
            </div>
            <input name="locale" type="hidden" value="es-MX" />
            <Button className="w-full" type="submit">
              Guardar contacto
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
