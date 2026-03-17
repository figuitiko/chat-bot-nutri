import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/http";
import { normalizeText } from "@/lib/bot/state-machine";
import { parseWhatsAppAddress } from "@/lib/phone";
import { resolveInboundResponse } from "@/lib/bot/executor";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import {
  closeOpenConversations,
  progressConversation,
  restartConversation,
  sendTemplateByKey,
  startFlowConversation,
} from "@/lib/services/flows-service";
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

async function getActiveConversation(contactId: string) {
  return db.conversation.findFirst({
    where: {
      contactId,
      status: "OPEN",
      currentStepId: {
        not: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

function resolveGlobalCommand(text: string) {
  const normalized = normalizeText(text);

  if (["menu", "inicio", "help", "ayuda"].includes(normalized)) {
    return "menu" as const;
  }

  if (["reiniciar", "restart", "reset"].includes(normalized)) {
    return "restart" as const;
  }

  if (["cancelar", "cancel", "salir"].includes(normalized)) {
    return "cancel" as const;
  }

  return null;
}

function resolveInboundInput(payload: Record<string, string | undefined>) {
  return payload.ButtonPayload?.trim() || payload.Body?.trim() || "";
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

  const activeConversation = await getActiveConversation(contact.id);
  let responseMessageSid: string | null = null;
  let conversationId: string | null = activeConversation?.id ?? null;
  let matchedFlowKey: string | null = null;
  let matchedTemplateKey: string | null = null;
  let replied = false;
  const inboundInput = resolveInboundInput(payload);
  const globalCommand = resolveGlobalCommand(inboundInput);

  if (globalCommand === "menu") {
    await closeOpenConversations(contact.id);

    const started = await startFlowConversation({
      contactId: contact.id,
      contactPhone,
      flowKey: "welcome",
    });

    conversationId = started.conversation.id;
    matchedFlowKey = started.flow.key;
    matchedTemplateKey = started.step.templateKey;
    responseMessageSid = started.providerMessageSid;
    replied = true;
  } else if (globalCommand === "restart" && activeConversation) {
    const restarted = await restartConversation({
      conversationId: activeConversation.id,
      contactPhone,
    });

    conversationId = restarted.conversation.id;
    matchedFlowKey = restarted.flow.key;
    matchedTemplateKey = restarted.step.templateKey;
    responseMessageSid = restarted.providerMessageSid;
    replied = true;
  } else if (globalCommand === "restart") {
    const started = await startFlowConversation({
      contactId: contact.id,
      contactPhone,
      flowKey: "welcome",
    });

    conversationId = started.conversation.id;
    matchedFlowKey = started.flow.key;
    matchedTemplateKey = started.step.templateKey;
    responseMessageSid = started.providerMessageSid;
    replied = true;
  } else if (globalCommand === "cancel") {
    await closeOpenConversations(contact.id);

    const response = await sendTemplateByKey({
      contactId: contact.id,
      contactPhone,
      templateKey: "conversation_cancelled",
      conversationId,
    });

    matchedTemplateKey = "conversation_cancelled";
    responseMessageSid = response.providerMessage.sid;
    replied = true;
    conversationId = null;
  }

  if (!replied && activeConversation) {
    const progressed = await progressConversation({
      conversationId: activeConversation.id,
      text: inboundInput,
      contactPhone,
    });

    if (progressed) {
      conversationId = progressed.conversation.id;
      matchedFlowKey = progressed.nextStep.flowId;
      matchedTemplateKey = progressed.nextStep.templateKey;
      responseMessageSid = progressed.providerMessageSid;
      replied = true;
    }
  }

  if (!replied) {
    const match = await resolveInboundResponse(inboundInput);

    if (match?.targetFlowKey) {
      const started = await startFlowConversation({
        contactId: contact.id,
        contactPhone,
        flowKey: match.targetFlowKey,
      });

      conversationId = started.conversation.id;
      matchedFlowKey = started.flow.key;
      matchedTemplateKey = started.step.templateKey;
      responseMessageSid = started.providerMessageSid;
      replied = true;
    } else if (match?.responseTemplateKey) {
      const response = await sendTemplateByKey({
        contactId: contact.id,
        contactPhone,
        templateKey: match.responseTemplateKey,
        conversationId,
      });

      matchedFlowKey = match.flowKey;
      matchedTemplateKey = match.responseTemplateKey;
      responseMessageSid = response.providerMessage.sid;
      replied = true;
    }
  }

  const inboundMessage = await storeInboundMessage({
    body: payload.Body ?? "",
    contactId: contact.id,
    conversationId,
    providerMessageSid,
    rawPayload: payload,
  });

  if (!replied && conversationId) {
    await db.conversation.update({
      where: { id: conversationId },
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
        ...(replied ? { lastOutboundAt: new Date() } : {}),
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
    replied,
    contactId: contact.id,
    inboundMessageId: inboundMessage.id,
    matchedFlowKey,
    matchedTemplateKey,
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
