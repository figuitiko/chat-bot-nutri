import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { handleRouteError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;

    return jsonOk({
      service: "whatsapp-predefined-bot-backend",
      version: APP_VERSION,
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      checks: {
        database: "up",
        twilioConfigured: Boolean(
          env.TWILIO_ACCOUNT_SID &&
            env.TWILIO_AUTH_TOKEN &&
            env.TWILIO_WHATSAPP_FROM &&
            env.TWILIO_STATUS_CALLBACK_URL,
        ),
      },
      diagnostics: {
        runtime: "nodejs",
        dashboardEnabled: true,
        blobConfigured: Boolean(env.BLOB_READ_WRITE_TOKEN),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
