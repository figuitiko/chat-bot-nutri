import { z } from "zod";

const phoneLikeSchema = z
  .string()
  .trim()
  .min(8, "El telefono debe incluir lada y numero.")
  .max(24, "El telefono es demasiado largo.");

const shortTextSchema = z.string().trim().min(1).max(120);

export const variablesSchema = z
  .record(z.string().trim().min(1).max(64), z.string().trim().max(500))
  .default({});

export const upsertContactSchema = z.object({
  phone: phoneLikeSchema,
  waId: z.string().trim().max(64).optional(),
  name: shortTextSchema.optional(),
  profileName: shortTextSchema.optional(),
  locale: z.string().trim().min(2).max(12).default("es-MX"),
  isOptedIn: z.boolean().default(true),
});
