export type TwilioWebhookPayload = Record<string, string>;

export type TwilioDeliveryStatus =
  | "queued"
  | "accepted"
  | "scheduled"
  | "sending"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "read"
  | "received";
