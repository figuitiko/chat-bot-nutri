import {
  FlowStepRenderMode,
  MessageStatus,
  MessageType,
  type CourseStep,
  type CourseTransition,
} from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { ensureTemplateBody, renderTemplateBody } from "@/lib/bot/responses";
import {
  matchStepTransition,
  mergeConversationContext,
  readConversationContext,
  resolveCapturedValue,
} from "@/lib/bot/state-machine";
import { storeOutboundMessage } from "@/lib/services/messages-service";
import {
  createWhatsAppInteractiveTemplate,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type WhatsAppInteractiveMode,
  type WhatsAppInteractiveOption,
} from "@/lib/twilio";

export type DeferredCourseFollowUp = {
  type: "course-step";
  courseStepId: string;
  conversationId?: string | null;
  variables?: Record<string, string>;
};

type RuntimeCourseStep = Pick<
  CourseStep,
  | "id"
  | "slug"
  | "moduleId"
  | "body"
  | "kind"
  | "deliveryMode"
  | "renderMode"
  | "mediaUrl"
  | "captureKey"
  | "assessmentKey"
  | "correctAnswer"
  | "scoreWeight"
  | "isAssessmentResult"
  | "isTerminal"
> & {
  transitions: Array<
    Pick<
      CourseTransition,
      "id" | "matchType" | "pattern" | "displayLabel" | "displayHint" | "outputValue" | "priority"
    >
  >;
  module: {
    id: string;
    courseId: string;
  };
};

function resolveStepMediaUrl(mediaUrl: string | null | undefined) {
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

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildChoiceTitle(
  transition: Pick<CourseTransition, "pattern" | "outputValue" | "displayLabel">,
) {
  if (transition.displayLabel?.trim()) {
    return transition.displayLabel.trim();
  }

  const outputValue = transition.outputValue?.trim();
  const pattern = transition.pattern.trim();

  if (outputValue) {
    return /^\d+$/.test(pattern) ? pattern : outputValue;
  }

  return toTitleCase(pattern);
}

function buildChoiceDescription(
  transition: Pick<CourseTransition, "pattern" | "outputValue" | "displayHint">,
) {
  if (transition.displayHint?.trim()) {
    return transition.displayHint.trim();
  }

  const pattern = transition.pattern.trim();
  const outputValue = transition.outputValue?.trim();

  if (!outputValue || !/^\d+$/.test(pattern)) {
    return undefined;
  }

  return outputValue;
}

function buildInteractiveOptions(step: RuntimeCourseStep): WhatsAppInteractiveOption[] {
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
  step: RuntimeCourseStep,
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

async function buildConversationVariables(
  contextData: Record<string, string>,
  step?: RuntimeCourseStep,
) {
  const variables = { ...contextData };

  if (step?.isAssessmentResult && step.assessmentKey) {
    const scoredSteps = await db.courseStep.findMany({
      where: {
        module: {
          courseId: step.module.courseId,
        },
        assessmentKey: step.assessmentKey,
        isActive: true,
        captureKey: { not: null },
        correctAnswer: { not: null },
        scoreWeight: { not: null },
      },
      select: {
        captureKey: true,
        correctAnswer: true,
        scoreWeight: true,
      },
    });

    const totalQuestions = scoredSteps.length;
    const totalWeight = scoredSteps.reduce((sum, current) => sum + (current.scoreWeight ?? 0), 0);
    const earnedWeight = scoredSteps.reduce((sum, current) => {
      if (!current.captureKey || !current.correctAnswer) {
        return sum;
      }

      return contextData[current.captureKey] === current.correctAnswer
        ? sum + (current.scoreWeight ?? 0)
        : sum;
    }, 0);
    const correctAnswers = scoredSteps.filter(
      (current) =>
        current.captureKey &&
        current.correctAnswer &&
        contextData[current.captureKey] === current.correctAnswer,
    ).length;

    variables.evaluationCorrectAnswers = String(correctAnswers);
    variables.evaluationTotalQuestions = String(totalQuestions);
    variables.evaluationEarnedWeight = String(earnedWeight);
    variables.evaluationTotalWeight = String(totalWeight);
    variables.evaluationPercentage =
      totalWeight > 0 ? String(Math.round((earnedWeight / totalWeight) * 100)) : "0";
  }

  return variables;
}

async function ensureInteractiveStepContentSid(step: RuntimeCourseStep, variables?: Record<string, string>) {
  const options = buildInteractiveOptions(step);
  const mode = resolveInteractiveMode(step, options);

  if (!mode) {
    return null;
  }

  const shouldPersist = !variables || Object.keys(variables).length === 0;
  const existingContentSid = await db.messageTemplate.findFirst({
    where: { key: step.slug, isActive: true },
    select: { twilioContentSid: true },
  });

  if (existingContentSid?.twilioContentSid && shouldPersist) {
    return existingContentSid.twilioContentSid;
  }

  const renderedBody = renderTemplateBody(ensureTemplateBody(step.body), variables);
  const content = await createWhatsAppInteractiveTemplate({
    friendlyName: step.slug,
    language: "es-MX",
    body: renderedBody,
    mode,
    options,
  });

  if (shouldPersist) {
    await db.messageTemplate.upsert({
      where: { key: step.slug },
      create: {
        key: step.slug,
        name: step.slug,
        body: step.body,
        kind: "TWILIO_CONTENT_TEMPLATE",
        twilioContentSid: content.sid,
      },
      update: {
        body: step.body,
        kind: "TWILIO_CONTENT_TEMPLATE",
        twilioContentSid: content.sid,
      },
    });
  }

  return content.sid;
}

async function getCourseStepById(stepId: string) {
  return db.courseStep.findUnique({
    where: { id: stepId },
    include: {
      module: {
        select: {
          id: true,
          courseId: true,
        },
      },
      transitions: {
        where: { isActive: true },
        orderBy: { priority: "asc" },
      },
    },
  });
}

async function getActiveCourseEntryStep() {
  const course = await db.course.findFirst({
    where: {
      isActive: true,
      status: "ACTIVE",
    },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              module: {
                select: {
                  id: true,
                  courseId: true,
                },
              },
              transitions: {
                where: { isActive: true },
                orderBy: { priority: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new AppError("ACTIVE_COURSE_NOT_FOUND", "No active course is configured.", 404);
  }

  const entryModule = course.modules[0];
  const entryStep = entryModule?.steps[0];

  if (!entryModule || !entryStep) {
    throw new AppError("COURSE_NOT_EXECUTABLE", "The active course does not have an entry step.", 422);
  }

  return { course, entryModule, entryStep };
}

async function sendMediaAttachment(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  courseStepId: string;
  mediaUrl: string;
  deferredFollowUp?: DeferredCourseFollowUp;
}) {
  const providerMessage = await sendWhatsAppTextMessage({
    to: input.contactPhone,
    mediaUrl: input.mediaUrl,
  });

  await storeOutboundMessage({
    body: input.mediaUrl,
    contactId: input.contactId,
    conversationId: input.conversationId,
    providerMessageSid: providerMessage.sid,
    rawPayload: {
      providerMessage,
      ...(input.deferredFollowUp ? { deferredFollowUp: input.deferredFollowUp } : {}),
    },
    status: MessageStatus.QUEUED,
    templateKey: input.courseStepId,
    messageType: MessageType.TEXT,
  });

  return providerMessage;
}

async function sendPlainTextStep(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  step: RuntimeCourseStep;
  variables?: Record<string, string>;
  skipMedia?: boolean;
}) {
  const body = renderTemplateBody(ensureTemplateBody(input.step.body), input.variables);
  const providerMessage = await sendWhatsAppTextMessage({
    to: input.contactPhone,
    body,
    mediaUrl: input.skipMedia ? undefined : resolveStepMediaUrl(input.step.mediaUrl),
  });

  const persisted = await storeOutboundMessage({
    body,
    contactId: input.contactId,
    conversationId: input.conversationId,
    providerMessageSid: providerMessage.sid,
    rawPayload: providerMessage,
    status: MessageStatus.QUEUED,
    templateKey: input.step.slug,
    messageType: MessageType.TEXT,
  });

  return { providerMessage, persisted };
}

export async function sendCourseStep(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  step: RuntimeCourseStep;
  variables?: Record<string, string>;
  skipMedia?: boolean;
}) {
  const renderedBody = renderTemplateBody(ensureTemplateBody(input.step.body), input.variables);
  const resolvedMediaUrl = input.skipMedia ? undefined : resolveStepMediaUrl(input.step.mediaUrl);

  if (resolvedMediaUrl && input.step.deliveryMode === "MEDIA_FIRST") {
    const providerMessage = await sendMediaAttachment({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      courseStepId: input.step.id,
      mediaUrl: resolvedMediaUrl,
      deferredFollowUp: {
        type: "course-step",
        courseStepId: input.step.id,
        conversationId: input.conversationId,
        variables: input.variables,
      },
    });

    return { providerMessage, persisted: null };
  }

  if (input.step.kind === "TWILIO_CONTENT_TEMPLATE") {
    if (resolvedMediaUrl) {
      await sendMediaAttachment({
        contactId: input.contactId,
        contactPhone: input.contactPhone,
        conversationId: input.conversationId,
        courseStepId: input.step.id,
        mediaUrl: resolvedMediaUrl,
      });
    }

    const contentSid = await ensureInteractiveStepContentSid(input.step, input.variables);

    if (!contentSid) {
      return sendPlainTextStep(input);
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
      templateKey: input.step.slug,
      messageType: MessageType.TEMPLATE,
    });

    return { providerMessage, persisted };
  }

  return sendPlainTextStep(input);
}

export async function dispatchDeferredCourseFollowUp(input: {
  contactId: string;
  contactPhone: string;
  courseStepId: string;
  conversationId?: string | null;
  variables?: Record<string, string>;
}) {
  const step = await getCourseStepById(input.courseStepId);

  if (!step) {
    throw new AppError("COURSE_STEP_NOT_FOUND", "Deferred course step was not found.", 404);
  }

  return sendCourseStep({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: input.conversationId,
    variables: input.variables,
    step,
    skipMedia: true,
  });
}

export async function startActiveCourseConversation(input: {
  contactId: string;
  contactPhone: string;
}) {
  const { course, entryModule, entryStep } = await getActiveCourseEntryStep();
  const contextData = mergeConversationContext(null, {});
  const conversation = await db.conversation.upsert({
    where: {
      contactId_courseId: {
        contactId: input.contactId,
        courseId: course.id,
      },
    },
    create: {
      contactId: input.contactId,
      courseId: course.id,
      currentCourseModuleId: entryModule.id,
      currentCourseStepId: entryStep.isTerminal ? null : entryStep.id,
      contextData,
      status: entryStep.isTerminal ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
    },
    update: {
      currentCourseModuleId: entryModule.id,
      currentCourseStepId: entryStep.isTerminal ? null : entryStep.id,
      contextData,
      status: entryStep.isTerminal ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
    },
  });

  const variables = await buildConversationVariables(readConversationContext(contextData), entryStep);
  const result = await sendCourseStep({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: conversation.id,
    step: entryStep,
    variables,
  });

  await db.contact.update({
    where: { id: input.contactId },
    data: { lastOutboundAt: new Date() },
  });

  return {
    conversation,
    course,
    module: entryModule,
    step: entryStep,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function getActiveCourseConversation(contactId: string) {
  return db.conversation.findFirst({
    where: {
      contactId,
      status: "OPEN",
      currentCourseStepId: {
        not: null,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function progressCourseConversation(input: {
  conversationId: string;
  text: string;
  contactPhone: string;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    include: {
      currentCourseStep: {
        include: {
          module: {
            select: {
              id: true,
              courseId: true,
            },
          },
          transitions: {
            where: { isActive: true },
            orderBy: { priority: "asc" },
            include: {
              nextStep: {
                include: {
                  module: {
                    select: {
                      id: true,
                      courseId: true,
                    },
                  },
                  transitions: {
                    where: { isActive: true },
                    orderBy: { priority: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!conversation?.currentCourseStep) {
    return null;
  }

  const transition = matchStepTransition(conversation.currentCourseStep.transitions, input.text);

  if (!transition?.nextStep) {
    return null;
  }

  const contextData = mergeConversationContext(
    conversation.contextData,
    resolveCapturedValue(conversation.currentCourseStep, transition, input.text),
  );

  const nextStep = transition.nextStep;
  const nextStatus = nextStep.isTerminal ? "CLOSED" : "OPEN";
  const updatedConversation = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      courseId: nextStep.module.courseId,
      currentCourseModuleId: nextStep.module.id,
      currentCourseStepId: nextStep.isTerminal ? null : nextStep.id,
      contextData,
      status: nextStatus,
      lastMessageAt: new Date(),
    },
  });

  const variables = await buildConversationVariables(readConversationContext(contextData), nextStep);
  const result = await sendCourseStep({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    conversationId: updatedConversation.id,
    step: nextStep,
    variables,
  });

  await db.contact.update({
    where: { id: conversation.contactId },
    data: { lastOutboundAt: new Date() },
  });

  return {
    conversation: updatedConversation,
    nextStep,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function restartCourseConversation(input: {
  conversationId: string;
  contactPhone: string;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: input.conversationId },
    select: {
      contactId: true,
      courseId: true,
    },
  });

  if (!conversation?.contactId) {
    throw new AppError("CONVERSATION_NOT_FOUND", "Course conversation was not found.", 404);
  }

  if (!conversation.courseId) {
    return startActiveCourseConversation({
      contactId: conversation.contactId,
      contactPhone: input.contactPhone,
    });
  }

  await db.course.updateMany({
    where: { id: conversation.courseId },
    data: {},
  });

  const course = await db.course.findUnique({
    where: { id: conversation.courseId },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
              module: {
                select: {
                  id: true,
                  courseId: true,
                },
              },
              transitions: {
                where: { isActive: true },
                orderBy: { priority: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const entryModule = course?.modules[0];
  const entryStep = entryModule?.steps[0];

  if (!course || !entryModule || !entryStep) {
    throw new AppError("COURSE_NOT_EXECUTABLE", "The course does not have an entry step.", 422);
  }

  const contextData = mergeConversationContext(null, {});
  const updatedConversation = await db.conversation.update({
    where: { id: input.conversationId },
    data: {
      currentCourseModuleId: entryModule.id,
      currentCourseStepId: entryStep.isTerminal ? null : entryStep.id,
      contextData,
      status: entryStep.isTerminal ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
    },
  });

  const result = await sendCourseStep({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    conversationId: updatedConversation.id,
    step: entryStep,
    variables: await buildConversationVariables(readConversationContext(contextData), entryStep),
  });

  return {
    conversation: updatedConversation,
    course,
    module: entryModule,
    step: entryStep,
    providerMessageSid: result.providerMessage.sid,
  };
}
