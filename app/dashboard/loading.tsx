import { LoadingPanel } from "@/components/dashboard/loading-panel";

export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <LoadingPanel
        title="Cargando resumen"
        description="Recuperando cursos, conversaciones, contactos y estado de publicacion."
        rows={2}
      />
      <LoadingPanel
        title="Cargando editor"
        description="Armando los modulos, pasos, transiciones y assets del curso."
        rows={4}
      />
    </div>
  );
}
