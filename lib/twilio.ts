import twilio, { twiml } from "twilio";

import { env } from "@/lib/env";
import { normalizeWhatsAppAddress } from "@/lib/phone";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export async function sendWhatsAppTextMessage(input: {
  to: string;
  body: string;
  statusCallbackUrl?: string;
}) {
  return client.messages.create({
    from: env.TWILIO_WHATSAPP_FROM,
    to: normalizeWhatsAppAddress(input.to),
    body: input.body,
    statusCallback: input.statusCallbackUrl ?? env.TWILIO_STATUS_CALLBACK_URL,
  });
}

export async function sendWhatsAppTemplateMessage(input: {
  to: string;
  contentSid: string;
  variables?: Record<string, string>;
  statusCallbackUrl?: string;
}) {
  return client.messages.create({
    from: env.TWILIO_WHATSAPP_FROM,
    to: normalizeWhatsAppAddress(input.to),
    contentSid: input.contentSid,
    contentVariables: input.variables ? JSON.stringify(input.variables) : undefined,
    statusCallback: input.statusCallbackUrl ?? env.TWILIO_STATUS_CALLBACK_URL,
  });
}

export function buildEmptyTwimlResponse() {
  const response = new twiml.MessagingResponse();
  return response.toString();
}

export function verifyTwilioSignature(
  url: string,
  signature: string | null,
  params: Record<string, string>,
) {
  if (!env.TWILIO_VALIDATE_SIGNATURE) {
    return true;
  }

  if (!signature) {
    return false;
  }

  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
}
