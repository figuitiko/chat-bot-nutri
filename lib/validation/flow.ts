import { z } from "zod";

import { variablesSchema } from "@/lib/validation/contact";

export const executeFlowRequestSchema = z.object({
  contactPhone: z.string().min(8),
  flowKey: z.string().trim().min(1),
  variables: variablesSchema.optional(),
});
