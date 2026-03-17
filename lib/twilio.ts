import twilio, { twiml } from "twilio";

import { env } from "@/lib/env";
import { normalizeWhatsAppAddress } from "@/lib/phone";

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export type WhatsAppInteractiveMode = "quick-reply" | "list-picker";

export type WhatsAppInteractiveOption = {
  id: string;
  title: string;
  description?: string;
};

export async function sendWhatsAppTextMessage(input: {
  to: string;
  body?: string;
  mediaUrl?: string | string[];
  statusCallbackUrl?: string;
}) {
  return client.messages.create({
    from: env.TWILIO_WHATSAPP_FROM,
    to: normalizeWhatsAppAddress(input.to),
    ...(input.body ? { body: input.body } : {}),
    mediaUrl:
      typeof input.mediaUrl === "string"
        ? [input.mediaUrl]
        : input.mediaUrl,
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

export async function createWhatsAppInteractiveTemplate(input: {
  friendlyName: string;
  language: string;
  body: string;
  mode: WhatsAppInteractiveMode;
  options: WhatsAppInteractiveOption[];
}) {
  const normalizedLanguage = input.language.split(/[-_]/)[0] || "es";
  const types =
    input.mode === "list-picker"
      ? {
          "twilio/text": {
            body: input.body,
          },
          "twilio/list-picker": {
            body: input.body,
            button: "OPCIONES",
            items: input.options.map((option) => ({
              id: option.id,
              item: option.title,
              description: option.description,
            })),
          },
        }
      : {
          "twilio/text": {
            body: input.body,
          },
          "twilio/quick-reply": {
            body: input.body,
            actions: input.options.map((option) => ({
              id: option.id,
              title: option.title,
            })),
          },
        };

  return client.content.v1.contents.create({
    friendlyName: input.friendlyName,
    language: normalizedLanguage,
    types: types as never,
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
