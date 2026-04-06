import { Card, CardContent, CardHeader } from "@/components/ui/card";

type LoadingPanelProps = {
  title?: string;
  description?: string;
  rows?: number;
};

export function LoadingPanel({
  title = "Cargando contenido",
  description = "Preparando el dashboard y sus datos.",
  rows = 3,
}: LoadingPanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded-full bg-slate-200" />
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
          />
        ))}
      </CardContent>
    </Card>
  );
}
