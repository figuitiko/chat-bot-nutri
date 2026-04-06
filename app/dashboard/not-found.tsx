import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardNotFound() {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-50/80">
      <CardHeader>
        <CardTitle>Recurso no encontrado</CardTitle>
        <CardDescription>
          Ese curso o contacto ya no existe. Vuelve al panel para elegir otro recurso.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard">Ir al resumen</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/courses">Ver cursos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
