import { z } from "zod";

import { variablesSchema } from "@/lib/validation/contact";

export const sendMessageRequestSchema = z
  .object({
    contactPhone: z.string().min(8),
    templateKey: z.string().trim().min(1).optional(),
    flowKey: z.string().trim().min(1).optional(),
    variables: variablesSchema.optional(),
  })
  .refine((value) => value.templateKey || value.flowKey, {
    message: "Either templateKey or flowKey is required.",
    path: ["templateKey"],
  });
