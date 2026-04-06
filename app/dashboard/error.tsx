"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="border-rose-200 bg-rose-50/60">
      <CardHeader>
        <CardTitle>No se pudo cargar el dashboard</CardTitle>
        <CardDescription>
          Revisa la conexion a la base de datos o intenta recargar esta vista.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button onClick={reset} type="button">
          Reintentar
        </Button>
        <p className="text-sm text-slate-600">
          Detalle tecnico: {error.message || "Error inesperado."}
        </p>
      </CardContent>
    </Card>
  );
}
