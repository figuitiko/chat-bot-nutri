import { z } from "zod";

export const variablesSchema = z.record(z.string(), z.string()).default({});

export const upsertContactSchema = z.object({
  phone: z.string().min(8),
  waId: z.string().optional(),
  name: z.string().trim().min(1).optional(),
  profileName: z.string().trim().min(1).optional(),
  locale: z.string().trim().min(2).default("es-MX"),
  isOptedIn: z.boolean().default(true),
});
