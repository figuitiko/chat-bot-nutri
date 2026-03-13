import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/http";
import { parseWhatsAppAddress } from "@/lib/phone";
import { resolveInboundResponse } from "@/lib/bot/executor";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import { sendTemplateByKey } from "@/lib/services/flows-service";
import { mapTwilioStatus, storeInboundMessage } from "@/lib/services/messages-service";

async function upsertWebhookEvent(input: {
  source: "TWILIO_INBOUND" | "TWILIO_STATUS";
  eventId?: string;
  payload: Prisma.InputJsonValue;
  status: string;
}) {
  if (input.eventId) {
    return db.webhookEvent.upsert({
      where: {
        source_eventId: {
          source: input.source,
          eventId: input.eventId,
        },
      },
      create: {
        source: input.source,
        eventId: input.eventId,
        payload: input.payload,
        status: input.status,
      },
      update: {
        payload: input.payload,
        status: input.status,
      },
    });
  }

  return db.webhookEvent.create({
    data: {
      source: input.source,
      payload: input.payload,
      status: input.status,
    },
  });
}

async function getConversation(contactId: string, flowId: string | null) {
  if (flowId) {
    return db.conversation.upsert({
      where: {
        contactId_flowId: {
          contactId,
          flowId,
        },
      },
      create: {
        contactId,
        flowId,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
      update: {
        status: "OPEN",
        lastMessageAt: new Date(),
      },
    });
  }

  const existing = await db.conversation.findFirst({
    where: {
      contactId,
      flowId: null,
    },
  });

  if (existing) {
    return db.conversation.update({
      where: { id: existing.id },
      data: {
        status: "ESCALATED",
        lastMessageAt: new Date(),
      },
    });
  }

  return db.conversation.create({
    data: {
      contactId,
      flowId: null,
      status: "ESCALATED",
      lastMessageAt: new Date(),
    },
  });
}

export async function processInboundWebhook(payload: Record<string, string | undefined>) {
  const providerMessageSid = payload.MessageSid ?? payload.SmsSid;

  if (providerMessageSid) {
    const existingMessage = await db.message.findUnique({
      where: { providerMessageSid },
      select: { id: true },
    });

    if (existingMessage) {
      logger.info("webhook.inbound.duplicate", { providerMessageSid });
      return { duplicate: true, replied: false };
    }
  }

  const eventId = providerMessageSid ? `inbound:${providerMessageSid}` : undefined;
  await upsertWebhookEvent({
    source: "TWILIO_INBOUND",
    eventId,
    payload,
    status: "RECEIVED",
  });

  const contactPhone = parseWhatsAppAddress(payload.From);
  const contact = await upsertContactByPhone({
    phone: contactPhone,
    waId: payload.WaId,
    profileName: payload.ProfileName,
  });

  const match = await resolveInboundResponse(payload.Body ?? "");
  const flow = match
    ? await db.botFlow.findUnique({
        where: { key: match.flowKey },
      })
    : null;

  const conversation = await getConversation(contact.id, flow?.id ?? null);

  const inboundMessage = await storeInboundMessage({
    body: payload.Body ?? "",
    contactId: contact.id,
    conversationId: conversation.id,
    providerMessageSid,
    rawPayload: payload,
  });

  let responseMessageSid: string | null = null;

  if (match) {
    const response = await sendTemplateByKey({
      contactId: contact.id,
      contactPhone,
      templateKey: match.responseTemplateKey,
      conversationId: conversation.id,
    });
    responseMessageSid = response.providerMessage.sid;
  } else {
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "ESCALATED",
      },
    });
  }

  await Promise.all([
    db.contact.update({
      where: { id: contact.id },
      data: {
        lastInboundAt: new Date(),
        ...(match ? { lastOutboundAt: new Date() } : {}),
      },
    }),
    eventId
      ? db.webhookEvent.update({
          where: {
            source_eventId: {
              source: "TWILIO_INBOUND",
              eventId,
            },
          },
          data: {
            processedAt: new Date(),
            status: "PROCESSED",
          },
        })
      : Promise.resolve(),
  ]);

  return {
    duplicate: false,
    replied: Boolean(match),
    contactId: contact.id,
    inboundMessageId: inboundMessage.id,
    matchedFlowKey: match?.flowKey ?? null,
    matchedTemplateKey: match?.responseTemplateKey ?? null,
    responseMessageSid,
  };
}

export async function processStatusCallback(payload: Record<string, string | undefined>) {
  const messageSid = payload.MessageSid;
  const messageStatus = payload.MessageStatus;

  if (!messageSid || !messageStatus) {
    throw new AppError("INVALID_STATUS_CALLBACK", "Status callback is missing required fields.", 422);
  }

  const eventId = `status:${messageSid}:${messageStatus}`;
  const existingEvent = await db.webhookEvent.findUnique({
    where: {
      source_eventId: {
        source: "TWILIO_STATUS",
        eventId,
      },
    },
    select: { id: true },
  });

  if (existingEvent) {
    logger.info("webhook.status.duplicate", { eventId });
    return { duplicate: true };
  }

  await upsertWebhookEvent({
    source: "TWILIO_STATUS",
    eventId,
    payload,
    status: "RECEIVED",
  });

  const message = await db.message.findUnique({
    where: {
      providerMessageSid: messageSid,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "Provider message SID was not found.", 404);
  }

  const nextStatus = mapTwilioStatus(messageStatus);

  await Promise.all([
    db.message.update({
      where: { id: message.id },
      data: {
        status: nextStatus,
        errorCode: payload.ErrorCode ?? null,
        errorMessage: payload.ErrorMessage ?? null,
        rawPayload: payload,
      },
    }),
    db.webhookEvent.update({
      where: {
        source_eventId: {
          source: "TWILIO_STATUS",
          eventId,
        },
      },
      data: {
        processedAt: new Date(),
        status: "PROCESSED",
      },
    }),
  ]);

  return {
    duplicate: false,
    messageId: message.id,
    previousStatus: message.status,
    nextStatus,
  };
}
