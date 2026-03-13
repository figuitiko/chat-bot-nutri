import type { NextRequest } from "next/server";

import { TWILIO_SIGNATURE_HEADER } from "@/lib/constants";
import { handleRouteError, jsonError, jsonOk } from "@/lib/http";
import { processStatusCallback } from "@/lib/services/webhooks-service";
import { verifyTwilioSignature } from "@/lib/twilio";
import { twilioStatusWebhookSchema } from "@/lib/validation/webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    );
    const parsed = twilioStatusWebhookSchema.parse(payload);
    const signature = request.headers.get(TWILIO_SIGNATURE_HEADER);
    const isValid = verifyTwilioSignature(request.url, signature, payload);

    if (!isValid) {
      return jsonError("INVALID_TWILIO_SIGNATURE", "Twilio signature validation failed.", 403);
    }

    const result = await processStatusCallback(parsed);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
