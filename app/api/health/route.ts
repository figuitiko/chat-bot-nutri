import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    return jsonOk({
      service: "whatsapp-predefined-bot-backend",
      status: "ok",
      timestamp: new Date().toISOString(),
      checks: {
        database: "up",
        twilioConfigured: Boolean(
          env.TWILIO_ACCOUNT_SID &&
            env.TWILIO_AUTH_TOKEN &&
            env.TWILIO_WHATSAPP_FROM &&
            env.TWILIO_STATUS_CALLBACK_URL,
        ),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
