import { MessageStatus, MessageType } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { ensureTemplateBody, renderTemplateBody } from "@/lib/bot/responses";
import {
  matchStepTransition,
  mergeConversationContext,
  readConversationContext,
  resolveCapturedValue,
} from "@/lib/bot/state-machine";
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

async function getFlowWithEntryStep(flowKey: string) {
  const flow = await db.botFlow.findFirst({
    where: {
      key: flowKey,
      isActive: true,
    },
    include: {
      steps: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!flow) {
    throw new AppError("FLOW_NOT_FOUND", `Flow "${flowKey}" was not found or is inactive.`, 404);
  }

  const entryStep = flow.steps.find((step) => step.key === flow.entryStepKey) ?? flow.steps[0];

  if (!entryStep) {
    throw new AppError("FLOW_NOT_EXECUTABLE", `Flow "${flowKey}" does not have an active entry step.`, 422);
  }

  return { flow, entryStep };
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

export async function startFlowConversation(input: {
  contactId: string;
  contactPhone: string;
  flowKey: string;
  variables?: Record<string, string>;
}) {
  const { flow, entryStep } = await getFlowWithEntryStep(input.flowKey);
  const contextData = mergeConversationContext(null, input.variables ?? {});
  const initialStatus = entryStep.isTerminal ? "CLOSED" : "OPEN";
  const initialCurrentStepId = entryStep.isTerminal ? null : entryStep.id;

  const conversation = await db.conversation.upsert({
    where: {
      contactId_flowId: {
        contactId: input.contactId,
        flowId: flow.id,
      },
    },
    create: {
      contactId: input.contactId,
      flowId: flow.id,
      currentStepId: initialCurrentStepId,
      contextData,
      status: initialStatus,
      lastMessageAt: new Date(),
    },
    update: {
      currentStepId: initialCurrentStepId,
      contextData,
      status: initialStatus,
      lastMessageAt: new Date(),
    },
  });

  const result = await sendTemplateByKey({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    templateKey: entryStep.templateKey,
    variables: readConversationContext(contextData),
    conversationId: conversation.id,
  });

  await Promise.all([
    db.contact.update({
      where: { id: input.contactId },
      data: {
        lastOutboundAt: new Date(),
      },
    }),
    db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    }),
  ]);

  return {
    conversation: {
      ...conversation,
      currentStepId: initialCurrentStepId,
      contextData,
      status: initialStatus,
    },
    flow,
    step: entryStep,
    template: result.template,
    message: result.persisted,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function progressConversation(input: {
  conversationId: string;
  text: string;
  contactPhone: string;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      contact: true,
      currentStep: {
        include: {
          flow: true,
          transitions: {
            where: { isActive: true },
            orderBy: { priority: "asc" },
            include: {
              nextStep: true,
            },
          },
        },
      },
    },
  });

  if (!conversation || !conversation.currentStep) {
    return null;
  }

  const transition = matchStepTransition(conversation.currentStep.transitions, input.text);

  if (!transition || !transition.nextStep) {
    return null;
  }

  const contextData = mergeConversationContext(
    conversation.contextData,
    resolveCapturedValue(conversation.currentStep, transition, input.text),
  );
  const nextStep = transition.nextStep;
  const nextStatus = nextStep.isTerminal ? "CLOSED" : "OPEN";
  const nextCurrentStepId = nextStep.isTerminal ? null : nextStep.id;
  const nextFlowId = nextStep.flowId;

  const updatedConversation = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      flowId: nextFlowId,
      currentStepId: nextCurrentStepId,
      contextData,
      status: nextStatus,
      lastMessageAt: new Date(),
    },
  });

  const result = await sendTemplateByKey({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    templateKey: nextStep.templateKey,
    variables: readConversationContext(contextData),
    conversationId: conversation.id,
  });

  await db.contact.update({
    where: { id: conversation.contactId },
    data: {
      lastOutboundAt: new Date(),
    },
  });

  return {
    conversation: updatedConversation,
    previousStep: conversation.currentStep,
    nextStep,
    template: result.template,
    message: result.persisted,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function executeFlow(input: {
  contactPhone: string;
  flowKey: string;
  variables?: Record<string, string>;
}) {
  const normalizedPhone = normalizePhone(input.contactPhone);
  const contact = await upsertContactByPhone({ phone: normalizedPhone });
  const result = await startFlowConversation({
    contactId: contact.id,
    contactPhone: normalizedPhone,
    flowKey: input.flowKey,
    variables: input.variables,
  });

  return {
    contact,
    conversation: result.conversation,
    flow: result.flow,
    step: result.step,
    template: result.template,
    message: result.message,
    providerMessageSid: result.providerMessageSid,
  };
}
