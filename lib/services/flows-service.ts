import { MessageStatus, MessageType } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { renderTemplateBody, ensureTemplateBody } from "@/lib/bot/responses";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import { storeOutboundMessage } from "@/lib/services/messages-service";
import { sendWhatsAppTemplateMessage, sendWhatsAppTextMessage } from "@/lib/twilio";

async function getActiveTemplate(templateKey: string) {
  const template = await db.messageTemplate.findFirst({
    where: {
      key: templateKey,
      isActive: true,
    },
  });

  if (!template) {
    throw new AppError("TEMPLATE_NOT_FOUND", `Template "${templateKey}" was not found or is inactive.`, 404);
  }

  return template;
}

export async function sendTemplateByKey(input: {
  contactId: string;
  contactPhone: string;
  templateKey: string;
  variables?: Record<string, string>;
  conversationId?: string | null;
}) {
  const template = await getActiveTemplate(input.templateKey);

  try {
    if (template.kind === "TWILIO_CONTENT_TEMPLATE") {
      if (!template.twilioContentSid) {
        throw new AppError(
          "INVALID_TEMPLATE",
          `Template "${input.templateKey}" is missing twilioContentSid.`,
          500,
        );
      }

      const providerMessage = await sendWhatsAppTemplateMessage({
        to: input.contactPhone,
        contentSid: template.twilioContentSid,
        variables: input.variables,
      });

      const persisted = await storeOutboundMessage({
        body: ensureTemplateBody(template.body),
        contactId: input.contactId,
        conversationId: input.conversationId,
        providerMessageSid: providerMessage.sid,
        rawPayload: providerMessage,
        status: MessageStatus.QUEUED,
        templateKey: input.templateKey,
        messageType: MessageType.TEMPLATE,
      });

      return { template, providerMessage, persisted };
    }

    const body = renderTemplateBody(ensureTemplateBody(template.body), input.variables);
    const providerMessage = await sendWhatsAppTextMessage({
      to: input.contactPhone,
      body,
    });

    const persisted = await storeOutboundMessage({
      body,
      contactId: input.contactId,
      conversationId: input.conversationId,
      providerMessageSid: providerMessage.sid,
      rawPayload: providerMessage,
      status: MessageStatus.QUEUED,
      templateKey: input.templateKey,
      messageType: MessageType.TEXT,
    });

    return { template, providerMessage, persisted };
  } catch (error) {
    logger.error("twilio.send.failed", {
      contactPhone: input.contactPhone,
      templateKey: input.templateKey,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    await storeOutboundMessage({
      body: template.body,
      contactId: input.contactId,
      conversationId: input.conversationId,
      rawPayload: { error: error instanceof Error ? error.message : "Unknown error" },
      status: MessageStatus.FAILED,
      templateKey: input.templateKey,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      messageType:
        template.kind === "TWILIO_CONTENT_TEMPLATE" ? MessageType.TEMPLATE : MessageType.TEXT,
    });

    throw new AppError("TWILIO_SEND_FAILED", "Twilio failed to send the WhatsApp message.", 502);
  }
}

export async function executeFlow(input: {
  contactPhone: string;
  flowKey: string;
  variables?: Record<string, string>;
}) {
  const normalizedPhone = normalizePhone(input.contactPhone);

  const [contact, flow] = await Promise.all([
    upsertContactByPhone({ phone: normalizedPhone }),
    db.botFlow.findFirst({
      where: {
        key: input.flowKey,
        isActive: true,
      },
    }),
  ]);

  if (!flow) {
    throw new AppError("FLOW_NOT_FOUND", `Flow "${input.flowKey}" was not found or is inactive.`, 404);
  }

  if (!flow.fallbackTemplateKey) {
    throw new AppError(
      "FLOW_NOT_EXECUTABLE",
      `Flow "${input.flowKey}" does not have a fallback template configured.`,
      422,
    );
  }

  const conversation = await db.conversation.upsert({
    where: {
      contactId_flowId: {
        contactId: contact.id,
        flowId: flow.id,
      },
    },
    create: {
      contactId: contact.id,
      flowId: flow.id,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
    update: {
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });

  const result = await sendTemplateByKey({
    contactId: contact.id,
    contactPhone: normalizedPhone,
    templateKey: flow.fallbackTemplateKey,
    variables: input.variables,
    conversationId: conversation.id,
  });

  await Promise.all([
    db.contact.update({
      where: { id: contact.id },
      data: {
        lastOutboundAt: new Date(),
      },
    }),
    db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  return {
    contact,
    conversation,
    flow,
    template: result.template,
    message: result.persisted,
    providerMessageSid: result.providerMessage.sid,
  };
}
