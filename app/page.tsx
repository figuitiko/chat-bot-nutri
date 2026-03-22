import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#bbf7d0,_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eefbf4_100%)] p-6">
      <Card className="w-full max-w-2xl border-emerald-100 shadow-xl shadow-emerald-950/5">
        <CardHeader>
          <CardTitle>WhatsApp Course Studio</CardTitle>
          <CardDescription>
            El backend del bot sigue sirviendo webhooks y ahora tambien incluye un dashboard para
            administrar cursos, modulos, pasos, assets y evaluaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Abrir dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/api/health">Health API</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
