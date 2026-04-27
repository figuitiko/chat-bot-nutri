"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function StepSaveButton({ isSaved, href }: { isSaved: boolean; href: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(isSaved);

  useEffect(() => {
    if (!isSaved) return;
    const timer = setTimeout(() => {
      setSaved(false);
      router.replace(href);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSaved, href, router]);

  return (
    <Button
      type="submit"
      variant={saved ? "default" : "outline"}
      className={saved ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""}
    >
      {saved ? "✓ Guardado!" : "Guardar paso"}
    </Button>
  );
}
