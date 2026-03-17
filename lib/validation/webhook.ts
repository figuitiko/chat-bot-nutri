import { z } from "zod";

export const twilioInboundWebhookSchema = z.object({
  Body: z.string().default(""),
  ButtonPayload: z.string().optional(),
  ButtonText: z.string().optional(),
  From: z.string().min(1),
  To: z.string().min(1),
  WaId: z.string().optional(),
  ProfileName: z.string().optional(),
  MessageSid: z.string().optional(),
  SmsSid: z.string().optional(),
});

export const twilioStatusWebhookSchema = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  To: z.string().optional(),
  From: z.string().optional(),
});
