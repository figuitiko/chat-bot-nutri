import { z } from "zod";

import { variablesSchema } from "@/lib/validation/contact";

export const executeFlowRequestSchema = z.object({
  contactPhone: z.string().trim().min(8).max(24),
  flowKey: z.string().trim().min(1).max(120),
  variables: variablesSchema.optional(),
});
