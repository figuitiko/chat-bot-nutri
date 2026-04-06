import { z } from "zod";

import { variablesSchema } from "@/lib/validation/contact";

export const sendMessageRequestSchema = z
  .object({
    contactPhone: z.string().trim().min(8).max(24),
    templateKey: z.string().trim().min(1).max(120).optional(),
    flowKey: z.string().trim().min(1).max(120).optional(),
    variables: variablesSchema.optional(),
  })
  .refine((value) => value.templateKey || value.flowKey, {
    message: "templateKey o flowKey es requerido.",
    path: ["templateKey"],
  });
