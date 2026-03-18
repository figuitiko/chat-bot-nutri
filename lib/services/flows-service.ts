import {
  FlowStepRenderMode,
  MessageStatus,
  MessageType,
  type BotFlowStep,
  type BotFlowTransition,
} from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
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
import {
  createWhatsAppInteractiveTemplate,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type WhatsAppInteractiveMode,
  type WhatsAppInteractiveOption,
} from "@/lib/twilio";

type StepWithTransitions = Pick<
  BotFlowStep,
  | "id"
  | "key"
  | "flowId"
  | "renderMode"
  | "assessmentKey"
  | "correctAnswer"
  | "scoreWeight"
  | "isAssessmentResult"
  | "captureKey"
> & {
  transitions: Array<Pick<BotFlowTransition, "matchType" | "pattern" | "outputValue" | "priority">>;
};

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
        include: {
          transitions: {
            where: { isActive: true },
            orderBy: { priority: "asc" },
          },
        },
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

async function getStepWithTransitions(stepId: string) {
  return db.botFlowStep.findUnique({
    where: { id: stepId },
    include: {
      transitions: {
        where: { isActive: true },
        orderBy: { priority: "asc" },
      },
    },
  });
}

function resolveTemplateMediaUrl(mediaUrl: string | null | undefined) {
  if (!mediaUrl) {
    return undefined;
  }

  if (/^https?:\/\//i.test(mediaUrl)) {
    return mediaUrl;
  }

  const baseUrl = env.TWILIO_WEBHOOK_BASE_URL.replace(/\/$/, "");
  const path = mediaUrl.startsWith("/") ? mediaUrl : `/${mediaUrl}`;

  return `${baseUrl}${path}`;
}

function buildFallbackBody(body: string, mediaUrl?: string) {
  if (!mediaUrl) {
    return body;
  }

  return `${body}\n\nRecurso: ${mediaUrl}`;
}

async function buildConversationVariables(
  contextData: Record<string, string>,
  step?: StepWithTransitions,
) {
  const variables = { ...contextData };

  if (step?.isAssessmentResult && step.assessmentKey) {
    const scoredSteps = await db.botFlowStep.findMany({
      where: {
        flowId: step.flowId,
        assessmentKey: step.assessmentKey,
        isActive: true,
        captureKey: {
          not: null,
        },
        correctAnswer: {
          not: null,
        },
        scoreWeight: {
          not: null,
        },
      },
      select: {
        captureKey: true,
        correctAnswer: true,
        scoreWeight: true,
      },
    });

    const totalQuestions = scoredSteps.length;
    const totalWeight = scoredSteps.reduce((sum, scoredStep) => sum + (scoredStep.scoreWeight ?? 0), 0);
    const earnedWeight = scoredSteps.reduce((sum, scoredStep) => {
      if (!scoredStep.captureKey || !scoredStep.correctAnswer) {
        return sum;
      }

      return contextData[scoredStep.captureKey] === scoredStep.correctAnswer
        ? sum + (scoredStep.scoreWeight ?? 0)
        : sum;
    }, 0);
    const correctAnswers = scoredSteps.filter(
      (scoredStep) =>
        scoredStep.captureKey &&
        scoredStep.correctAnswer &&
        contextData[scoredStep.captureKey] === scoredStep.correctAnswer,
    ).length;
    const percentage =
      totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    variables.evaluationCorrectAnswers = String(correctAnswers);
    variables.evaluationTotalQuestions = String(totalQuestions);
    variables.evaluationEarnedWeight = String(earnedWeight);
    variables.evaluationTotalWeight = String(totalWeight);
    variables.evaluationPercentage = String(percentage);
  }

  return variables;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildChoiceTitle(transition: Pick<BotFlowTransition, "pattern" | "outputValue">) {
  const pattern = transition.pattern.trim();
  const outputValue = transition.outputValue?.trim();

  if (outputValue) {
    return /^\d+$/.test(pattern) ? pattern : outputValue;
  }

  return toTitleCase(pattern);
}

function buildChoiceDescription(transition: Pick<BotFlowTransition, "pattern" | "outputValue">) {
  const pattern = transition.pattern.trim();
  const outputValue = transition.outputValue?.trim();

  if (!outputValue || !/^\d+$/.test(pattern)) {
    return undefined;
  }

  return outputValue;
}

function buildInteractiveOptions(step: StepWithTransitions): WhatsAppInteractiveOption[] {
  const visibleTransitions = step.transitions.some((transition) => transition.matchType === "EXACT")
    ? step.transitions.filter((transition) => transition.matchType === "EXACT")
    : step.transitions.filter((transition) => transition.matchType !== "FALLBACK");

  return visibleTransitions
    .map((transition) => ({
      id: transition.pattern,
      title: buildChoiceTitle(transition),
      description: buildChoiceDescription(transition),
    }))
    .filter(
      (option, index, options) =>
        option.id &&
        options.findIndex((candidate) => candidate.id === option.id) === index,
    );
}

function resolveInteractiveMode(
  step: StepWithTransitions,
  options: WhatsAppInteractiveOption[],
): WhatsAppInteractiveMode | null {
  if (options.length < 1) {
    return null;
  }

  if (step.renderMode === FlowStepRenderMode.QUICK_REPLY) {
    return options.length <= 3 ? "quick-reply" : null;
  }

  if (step.renderMode === FlowStepRenderMode.LIST_PICKER) {
    return options.length <= 10 ? "list-picker" : null;
  }

  if (step.renderMode !== FlowStepRenderMode.AUTO) {
    return null;
  }

  if (options.length <= 3) {
    return "quick-reply";
  }

  if (options.length <= 10) {
    return "list-picker";
  }

  return null;
}

async function ensureInteractiveTemplateSid(input: {
  templateId: string;
  templateKey: string;
  templateName: string;
  body: string;
  language: string;
  existingContentSid: string | null;
  variables?: Record<string, string>;
  step?: StepWithTransitions;
}) {
  if (!input.step) {
    return input.existingContentSid;
  }

  const options = buildInteractiveOptions(input.step);
  const mode = resolveInteractiveMode(input.step, options);

  if (!mode) {
    return input.existingContentSid;
  }

  const shouldPersist = !input.variables || Object.keys(input.variables).length === 0;

  if (input.existingContentSid && shouldPersist) {
    return input.existingContentSid;
  }

  const content = await createWhatsAppInteractiveTemplate({
    friendlyName: `${input.templateName} (${input.step.key})`,
    language: input.language,
    body: input.body,
    mode,
    options,
  });

  if (shouldPersist) {
    await db.messageTemplate.update({
      where: { id: input.templateId },
      data: {
        twilioContentSid: content.sid,
      },
    });
  }

  return content.sid;
}

async function sendMediaAttachment(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  templateKey: string;
  mediaUrl: string;
}) {
  try {
    const providerMessage = await sendWhatsAppTextMessage({
      to: input.contactPhone,
      mediaUrl: input.mediaUrl,
    });

    await storeOutboundMessage({
      body: input.mediaUrl,
      contactId: input.contactId,
      conversationId: input.conversationId,
      providerMessageSid: providerMessage.sid,
      rawPayload: providerMessage,
      status: MessageStatus.QUEUED,
      templateKey: input.templateKey,
      messageType: MessageType.TEXT,
    });
  } catch (error) {
    logger.warn("twilio.media.attachment_failed", {
      contactPhone: input.contactPhone,
      templateKey: input.templateKey,
      mediaUrl: input.mediaUrl,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function sendPlainTextFollowUp(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  templateKey: string;
  body: string;
}) {
  const providerMessage = await sendWhatsAppTextMessage({
    to: input.contactPhone,
    body: input.body,
  });

  const persisted = await storeOutboundMessage({
    body: input.body,
    contactId: input.contactId,
    conversationId: input.conversationId,
    providerMessageSid: providerMessage.sid,
    rawPayload: providerMessage,
    status: MessageStatus.QUEUED,
    templateKey: input.templateKey,
    messageType: MessageType.TEXT,
  });

  return { providerMessage, persisted };
}

export async function sendTemplateByKey(input: {
  contactId: string;
  contactPhone: string;
  templateKey: string;
  variables?: Record<string, string>;
  conversationId?: string | null;
  step?: StepWithTransitions;
}) {
  const template = await getActiveTemplate(input.templateKey);
  const renderedBody = renderTemplateBody(ensureTemplateBody(template.body), input.variables);

  try {
    if (template.kind === "TWILIO_CONTENT_TEMPLATE") {
      const resolvedMediaUrl = resolveTemplateMediaUrl(template.mediaUrl);

      if (resolvedMediaUrl) {
        await sendMediaAttachment({
          contactId: input.contactId,
          contactPhone: input.contactPhone,
          conversationId: input.conversationId,
          templateKey: input.templateKey,
          mediaUrl: resolvedMediaUrl,
        });
      }

      const contentSid = await ensureInteractiveTemplateSid({
        templateId: template.id,
        templateKey: input.templateKey,
        templateName: template.name,
        body: renderedBody,
        language: template.language,
        existingContentSid: template.twilioContentSid,
        variables: input.variables,
        step: input.step,
      });

      if (!contentSid) {
        return sendPlainTextFollowUp({
          contactId: input.contactId,
          contactPhone: input.contactPhone,
          conversationId: input.conversationId,
          templateKey: input.templateKey,
          body: renderedBody,
        }).then(({ providerMessage, persisted }) => ({
          template,
          providerMessage,
          persisted,
        }));
      }

      const providerMessage = await sendWhatsAppTemplateMessage({
        to: input.contactPhone,
        contentSid,
        variables: input.variables,
      });

      const persisted = await storeOutboundMessage({
        body: renderedBody,
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

    const body = renderedBody;
    const resolvedMediaUrl = resolveTemplateMediaUrl(template.mediaUrl);
    let providerMessage;

    try {
      providerMessage = await sendWhatsAppTextMessage({
        to: input.contactPhone,
        body,
        mediaUrl: resolvedMediaUrl,
      });
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : undefined;
      const shouldRetryWithoutMedia = Boolean(resolvedMediaUrl) && errorCode === "63019";

      if (!shouldRetryWithoutMedia) {
        throw error;
      }

      logger.warn("twilio.media.retry_without_media", {
        contactPhone: input.contactPhone,
        templateKey: input.templateKey,
        mediaUrl: resolvedMediaUrl,
      });

      providerMessage = await sendWhatsAppTextMessage({
        to: input.contactPhone,
        body: buildFallbackBody(body, resolvedMediaUrl),
      });
    }

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
    variables: await buildConversationVariables(readConversationContext(contextData), entryStep),
    conversationId: conversation.id,
    step: entryStep,
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
  const nextStep = await getStepWithTransitions(transition.nextStep.id);

  if (!nextStep) {
    return null;
  }

  const nextStatus = nextStep.isTerminal ? "CLOSED" : "OPEN";
  const nextCurrentStepId = nextStep.isTerminal ? null : nextStep.id;
  const nextFlowId = nextStep.flowId;
  const isCrossFlowTransition = conversation.flowId && conversation.flowId !== nextFlowId;

  let updatedConversation;

  if (isCrossFlowTransition) {
    const targetConversation = await db.conversation.upsert({
      where: {
        contactId_flowId: {
          contactId: conversation.contactId,
          flowId: nextFlowId,
        },
      },
      create: {
        contactId: conversation.contactId,
        flowId: nextFlowId,
        currentStepId: nextCurrentStepId,
        contextData,
        status: nextStatus,
        lastMessageAt: new Date(),
      },
      update: {
        currentStepId: nextCurrentStepId,
        contextData,
        status: nextStatus,
        lastMessageAt: new Date(),
      },
    });

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        currentStepId: null,
        status: "CLOSED",
        lastMessageAt: new Date(),
      },
    });

    updatedConversation = targetConversation;
  } else {
    updatedConversation = await db.conversation.update({
      where: { id: conversation.id },
      data: {
        flowId: nextFlowId,
        currentStepId: nextCurrentStepId,
        contextData,
        status: nextStatus,
        lastMessageAt: new Date(),
      },
    });
  }

  const result = await sendTemplateByKey({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    templateKey: nextStep.templateKey,
    variables: await buildConversationVariables(readConversationContext(contextData), nextStep),
    conversationId: updatedConversation.id,
    step: nextStep,
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

export async function closeOpenConversations(contactId: string) {
  await db.conversation.updateMany({
    where: {
      contactId,
      status: "OPEN",
    },
    data: {
      status: "CLOSED",
      currentStepId: null,
      lastMessageAt: new Date(),
    },
  });
}

export async function restartConversation(input: {
  conversationId: string;
  contactPhone: string;
}) {
  const conversation = await db.conversation.findUnique({
    where: {
      id: input.conversationId,
    },
    include: {
      flow: true,
    },
  });

  if (!conversation?.flow) {
    throw new AppError("CONVERSATION_NOT_FOUND", "Conversation flow was not found.", 404);
  }

  return startFlowConversation({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    flowKey: conversation.flow.key,
  });
}
