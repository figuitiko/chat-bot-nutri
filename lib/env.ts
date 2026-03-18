import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  INTERNAL_API_KEY: z.string().min(16),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_STATUS_CALLBACK_URL: z.url(),
  TWILIO_VALIDATE_SIGNATURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  TWILIO_WEBHOOK_BASE_URL: z.url(),
  TWILIO_WHATSAPP_FROM: z.string().regex(/^whatsapp:\+\d{8,15}$/),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
