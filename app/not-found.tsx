import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dcfce7,_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eefbf4_100%)] p-6">
      <Card className="w-full max-w-lg border-emerald-100 shadow-xl shadow-emerald-950/5">
        <CardHeader>
          <CardTitle>La pagina no existe</CardTitle>
          <CardDescription>
            El recurso que buscabas no esta disponible o ya no forma parte del dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Volver al dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/health">Revisar health API</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
