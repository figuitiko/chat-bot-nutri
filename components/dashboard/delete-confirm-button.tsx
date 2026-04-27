"use client";

import { Button } from "@/components/ui/button";

interface DeleteConfirmButtonProps {
  action: (formData: FormData) => Promise<void>;
  message: string;
  children: React.ReactNode;
  hiddenFields: Record<string, string>;
}

export function DeleteConfirmButton({
  action,
  message,
  children,
  hiddenFields,
}: DeleteConfirmButtonProps) {
  return (
    <form action={action}>
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant="outline"
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={(e) => {
          if (!confirm(message)) {
            e.preventDefault();
          }
        }}
      >
        {children}
      </Button>
    </form>
  );
}
