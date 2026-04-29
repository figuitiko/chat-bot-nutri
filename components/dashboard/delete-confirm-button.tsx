"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface DeleteConfirmButtonProps {
  action: (formData: FormData) => Promise<void>;
  message: string;
  children: React.ReactNode;
  hiddenFields: Record<string, string>;
}

function DeleteSubmitButton({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
      onClick={(e) => {
        if (!confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Eliminando..." : children}
    </Button>
  );
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
      <DeleteSubmitButton message={message}>{children}</DeleteSubmitButton>
    </form>
  );
}
