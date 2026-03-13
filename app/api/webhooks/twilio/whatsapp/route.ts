import type { NextRequest } from "next/server";

import { TWILIO_SIGNATURE_HEADER } from "@/lib/constants";
import { handleRouteError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { processInboundWebhook } from "@/lib/services/webhooks-service";
import { buildEmptyTwimlResponse, verifyTwilioSignature } from "@/lib/twilio";
import { twilioInboundWebhookSchema } from "@/lib/validation/webhook";

export const runtime = "nodejs";

function twimlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    );
    const parsed = twilioInboundWebhookSchema.parse(payload);
    const signature = request.headers.get(TWILIO_SIGNATURE_HEADER);
    const isValid = verifyTwilioSignature(request.url, signature, payload);

    if (!isValid) {
      return twimlResponse(buildEmptyTwimlResponse(), 403);
    }

    const result = await processInboundWebhook(parsed);
    logger.info("webhook.inbound.processed", result);

    return twimlResponse(buildEmptyTwimlResponse());
  } catch (error) {
    logger.error("webhook.inbound.failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    const response = handleRouteError(error);
    return twimlResponse(buildEmptyTwimlResponse(), response.status);
  }
}
