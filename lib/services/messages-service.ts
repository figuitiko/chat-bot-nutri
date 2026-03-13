import type { Prisma } from "@/generated/prisma/client";
import {
  MessageDirection,
  MessageProvider,
  MessageStatus,
  MessageType,
} from "@/generated/prisma/client";

import { db } from "@/lib/db";

export async function storeInboundMessage(input: {
  body: string;
  contactId: string;
  conversationId?: string | null;
  providerMessageSid?: string;
  rawPayload: Prisma.InputJsonValue;
}) {
  return db.message.create({
    data: {
      body: input.body,
      channel: "WHATSAPP",
      contactId: input.contactId,
      conversationId: input.conversationId,
      direction: MessageDirection.INBOUND,
      messageType: MessageType.TEXT,
      provider: MessageProvider.TWILIO,
      providerMessageSid: input.providerMessageSid,
      rawPayload: input.rawPayload,
      status: MessageStatus.RECEIVED,
    },
  });
}

export async function storeOutboundMessage(input: {
  body: string;
  contactId: string;
  conversationId?: string | null;
  providerMessageSid?: string;
  status?: MessageStatus;
  templateKey?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  messageType?: MessageType;
  rawPayload: Prisma.InputJsonValue;
}) {
  return db.message.create({
    data: {
      body: input.body,
      channel: "WHATSAPP",
      contactId: input.contactId,
      conversationId: input.conversationId,
      direction: MessageDirection.OUTBOUND,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      messageType: input.messageType ?? MessageType.TEXT,
      provider: MessageProvider.TWILIO,
      providerMessageSid: input.providerMessageSid,
      rawPayload: input.rawPayload,
      status: input.status ?? MessageStatus.QUEUED,
      templateKey: input.templateKey,
    },
  });
}

export function mapTwilioStatus(status: string): MessageStatus {
  switch (status.toLowerCase()) {
    case "queued":
    case "accepted":
    case "scheduled":
      return MessageStatus.QUEUED;
    case "sending":
    case "sent":
      return MessageStatus.SENT;
    case "delivered":
      return MessageStatus.DELIVERED;
    case "failed":
    case "undelivered":
      return MessageStatus.FAILED;
    case "read":
      return MessageStatus.READ;
    case "received":
      return MessageStatus.RECEIVED;
    default:
      return MessageStatus.SENT;
  }
}
