import { z } from "zod";

const envSchema = z.object({
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_NAME: z.string().min(1).default("Admin"),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  DATABASE_URL: z.url(),
  INTERNAL_API_KEY: z.string().min(16),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SESSION_SECRET: z.string().min(32).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_MEDIA_FOLLOWUP_DELAY_MS: z.coerce.number().int().min(0).default(0),
  TWILIO_BURST_SOFT_WARNING_THRESHOLD: z.coerce.number().int().min(1).default(20),
  TWILIO_BURST_HARD_PAUSE_THRESHOLD: z.coerce.number().int().min(1).default(24),
  TWILIO_BURST_COOLDOWN_SECONDS: z.coerce.number().int().min(1).default(35),
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
