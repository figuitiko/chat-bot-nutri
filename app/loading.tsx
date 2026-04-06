import { LoadingPanel } from "@/components/dashboard/loading-panel";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16">
      <LoadingPanel
        title="Cargando la aplicacion"
        description="Conectando el dashboard, la base de datos y el runtime del bot."
        rows={4}
      />
    </main>
  );
}
