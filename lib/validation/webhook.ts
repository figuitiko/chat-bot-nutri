import { z } from "zod";

export const twilioInboundWebhookSchema = z.object({
  Body: z.string().max(4000).default(""),
  ButtonPayload: z.string().trim().max(200).optional(),
  ButtonText: z.string().trim().max(200).optional(),
  From: z.string().trim().min(1).max(64),
  To: z.string().trim().min(1).max(64),
  WaId: z.string().trim().max(64).optional(),
  ProfileName: z.string().trim().max(120).optional(),
  MessageSid: z.string().trim().max(64).optional(),
  SmsSid: z.string().trim().max(64).optional(),
});

export const twilioStatusWebhookSchema = z.object({
  MessageSid: z.string().trim().min(1).max(64),
  MessageStatus: z.string().trim().min(1).max(64),
  ErrorCode: z.string().trim().max(32).optional(),
  ErrorMessage: z.string().trim().max(500).optional(),
  To: z.string().trim().max(64).optional(),
  From: z.string().trim().max(64).optional(),
});
