"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export function ContactSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const q = next.trim();
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
    }, 300);
  }

  return (
    <Input
      type="search"
      placeholder="Buscar por nombre o teléfono..."
      value={value}
      onChange={handleChange}
      className="max-w-sm"
    />
  );
}
