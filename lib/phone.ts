import { AppError } from "@/lib/http";
import { WHATSAPP_PREFIX } from "@/lib/constants";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: string) {
  const trimmed = input.trim();
  const withoutPrefix = trimmed.startsWith(WHATSAPP_PREFIX)
    ? trimmed.slice(WHATSAPP_PREFIX.length)
    : trimmed;
  const digits = withoutPrefix.replace(/\D+/g, "");
  const normalized = `+${digits}`;

  if (!E164_PHONE.test(normalized)) {
    throw new AppError("INVALID_PHONE", "Phone number must be a valid E.164-like value.", 422);
  }

  return normalized;
}

export function normalizeWhatsAppAddress(input: string) {
  return `${WHATSAPP_PREFIX}${normalizePhone(input)}`;
}

export function parseWhatsAppAddress(input: string | null | undefined) {
  if (!input) {
    throw new AppError("INVALID_PHONE", "WhatsApp address is required.", 422);
  }

  return normalizePhone(input);
}
