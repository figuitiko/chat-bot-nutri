import {
  FlowStepRenderMode,
  MessageDirection,
  MessageStatus,
  MessageType,
  type CourseStep,
  type CourseTransition,
  type Prisma,
} from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { logger } from "@/lib/logger";
import { ensureTemplateBody, renderTemplateBody } from "@/lib/bot/responses";
import {
  matchStepTransition,
  mergeConversationContext,
  readConversationContext,
  resolveCapturedValue,
} from "@/lib/bot/state-machine";
import { storeOutboundMessage } from "@/lib/services/messages-service";
import {
  buildStepBodyWithDeliveryMode,
  estimateOutboundMessagesForStep,
  shouldPauseForTwilioBurst,
} from "@/lib/services/course-delivery";
import { persistCourseSurveySubmission } from "@/lib/services/course-survey";
import { buildChoiceDescription, buildChoiceTitle } from "@/lib/services/course-interactive-options";
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

const COURSE_BURST_PAUSE_REASON = "TWILIO_14107_GUARD";

type CourseConversationContext = Prisma.JsonValue | Prisma.InputJsonValue | null | undefined;

type PendingCourseStepState = {
  stepId: string;
  variables?: Record<string, string>;
  pauseUntil?: Date | null;
  pauseReason?: string;
};

type CourseBurstDecision = {
  recentOutboundCount: number;
  projectedOutboundCount: number;
  shouldWarn: boolean;
  shouldPause: boolean;
};

function parsePendingVariables(rawValue: string | undefined) {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value ?? "")]),
    );
  } catch {
    return undefined;
  }
}

function readPendingCourseStepState(contextData: CourseConversationContext): PendingCourseStepState | null {
  const context = readConversationContext(contextData);
  const stepId = context.pendingCourseStepId?.trim();

  if (!stepId) {
    return null;
  }

  const pauseUntil = context.rateLimitPauseUntil ? new Date(context.rateLimitPauseUntil) : null;

  return {
    stepId,
    variables: parsePendingVariables(context.pendingVariables),
    pauseUntil:
      pauseUntil && !Number.isNaN(pauseUntil.getTime()) ? pauseUntil : null,
    pauseReason: context.pauseReason,
  };
}

function withPendingCourseStepState(input: {
  contextData: CourseConversationContext;
  stepId: string;
  variables?: Record<string, string>;
  pauseUntil: Date;
}) {
  const context = readConversationContext(input.contextData);

  return {
    ...context,
    pendingCourseStepId: input.stepId,
    pendingVariables: JSON.stringify(input.variables ?? {}),
    rateLimitPauseUntil: input.pauseUntil.toISOString(),
    pauseReason: COURSE_BURST_PAUSE_REASON,
  };
}

function clearPendingCourseStepState(contextData: CourseConversationContext) {
  const context = { ...readConversationContext(contextData) };

  delete context.pendingCourseStepId;
  delete context.pendingVariables;
  delete context.rateLimitPauseUntil;
  delete context.pauseReason;

  return context;
}

async function countRecentOutboundMessages(contactId: string) {
  const windowStart = new Date(Date.now() - 30_000);

  return db.message.count({
    where: {
      contactId,
      direction: MessageDirection.OUTBOUND,
      createdAt: {
        gte: windowStart,
      },
    },
  });
}

async function getCourseBurstDecision(input: {
  contactId: string;
  step: RuntimeCourseStep;
}) : Promise<CourseBurstDecision> {
  const resolvedMediaUrl = resolveStepMediaUrl(input.step.mediaUrl);
  const projectedOutboundCount = estimateOutboundMessagesForStep({
    deliveryMode: input.step.deliveryMode,
    kind: input.step.kind,
    hasMedia: Boolean(resolvedMediaUrl),
  });
  const recentOutboundCount = await countRecentOutboundMessages(input.contactId);

  return {
    recentOutboundCount,
    projectedOutboundCount,
    shouldWarn:
      recentOutboundCount + projectedOutboundCount >=
      env.TWILIO_BURST_SOFT_WARNING_THRESHOLD,
    shouldPause: shouldPauseForTwilioBurst({
      recentOutboundCount,
      projectedOutboundCount,
      hardPauseThreshold: env.TWILIO_BURST_HARD_PAUSE_THRESHOLD,
    }),
  };
}

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

async function ensureInteractiveStepContentSid(input: {
  step: RuntimeCourseStep;
  renderedBody: string;
  variables?: Record<string, string>;
}) {
  const options = buildInteractiveOptions(input.step);
  const mode = resolveInteractiveMode(input.step, options);

  if (!mode) {
    return null;
  }

  const shouldPersist = !input.variables || Object.keys(input.variables).length === 0;
  const existingContentSid = await db.messageTemplate.findFirst({
    where: { key: input.step.slug, isActive: true },
    select: { twilioContentSid: true },
  });

  if (existingContentSid?.twilioContentSid && shouldPersist) {
    return existingContentSid.twilioContentSid;
  }

  const content = await createWhatsAppInteractiveTemplate({
    friendlyName: input.step.slug,
    language: "es-MX",
    body: input.renderedBody,
    mode,
    options,
  });

  if (shouldPersist) {
    await db.messageTemplate.upsert({
      where: { key: input.step.slug },
      create: {
        key: input.step.slug,
        name: input.step.slug,
        body: input.step.body,
        kind: "TWILIO_CONTENT_TEMPLATE",
        twilioContentSid: content.sid,
      },
      update: {
        body: input.step.body,
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

async function getCourseEntryStep(courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
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
    throw new AppError("COURSE_NOT_FOUND", "The selected course does not exist.", 404);
  }

  const entryModule = course.modules[0];
  const entryStep = entryModule?.steps[0];

  if (!entryModule || !entryStep) {
    throw new AppError("COURSE_NOT_EXECUTABLE", "The selected course does not have an entry step.", 422);
  }

  return { course, entryModule, entryStep };
}

async function maybePauseCourseConversationStep(input: {
  conversationId: string;
  contactId: string;
  step: RuntimeCourseStep;
  contextData: CourseConversationContext;
}) {
  const decision = await getCourseBurstDecision({
    contactId: input.contactId,
    step: input.step,
  });

  if (decision.shouldWarn && !decision.shouldPause) {
    logger.warn("course.delivery.high_burst_risk", {
      contactId: input.contactId,
      conversationId: input.conversationId,
      courseStepId: input.step.id,
      outboundCountLast30s: decision.recentOutboundCount,
      projectedOutboundCount: decision.projectedOutboundCount,
    });
  }

  if (!decision.shouldPause) {
    return null;
  }

  const pauseUntil = new Date(Date.now() + env.TWILIO_BURST_COOLDOWN_SECONDS * 1000);
  const contextData = withPendingCourseStepState({
    contextData: input.contextData,
    stepId: input.step.id,
    variables: await buildConversationVariables(
      readConversationContext(input.contextData),
      input.step,
    ),
    pauseUntil,
  });

  const conversation = await db.conversation.update({
    where: { id: input.conversationId },
    data: {
      courseId: input.step.module.courseId,
      selectedCourseId: input.step.module.courseId,
      currentCourseModuleId: input.step.module.id,
      currentCourseStepId: input.step.id,
      contextData,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });

  logger.warn("course.delivery.paused_for_twilio_burst", {
    contactId: input.contactId,
    conversationId: input.conversationId,
    courseStepId: input.step.id,
    outboundCountLast30s: decision.recentOutboundCount,
    projectedOutboundCount: decision.projectedOutboundCount,
    pauseUntil: pauseUntil.toISOString(),
  });

  return { conversation, pauseUntil, ...decision };
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
  const resolvedMediaUrl = input.skipMedia ? undefined : resolveStepMediaUrl(input.step.mediaUrl);
  const body = buildStepBodyWithDeliveryMode({
    body: renderTemplateBody(ensureTemplateBody(input.step.body), input.variables),
    deliveryMode: input.step.deliveryMode,
    resolvedMediaUrl,
  });
  const providerMessage = await sendWhatsAppTextMessage({
    to: input.contactPhone,
    body,
    mediaUrl:
      input.step.deliveryMode === "LINK_ONLY" ? undefined : resolvedMediaUrl,
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
  const resolvedMediaUrl = input.skipMedia ? undefined : resolveStepMediaUrl(input.step.mediaUrl);
  const renderedBody = buildStepBodyWithDeliveryMode({
    body: renderTemplateBody(ensureTemplateBody(input.step.body), input.variables),
    deliveryMode: input.step.deliveryMode,
    resolvedMediaUrl,
  });
  const attachableMediaUrl =
    input.step.deliveryMode === "LINK_ONLY" ? undefined : resolvedMediaUrl;

  if (attachableMediaUrl && input.step.deliveryMode === "MEDIA_FIRST") {
    const providerMessage = await sendMediaAttachment({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      courseStepId: input.step.id,
      mediaUrl: attachableMediaUrl,
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
    if (attachableMediaUrl) {
      await sendMediaAttachment({
        contactId: input.contactId,
        contactPhone: input.contactPhone,
        conversationId: input.conversationId,
        courseStepId: input.step.id,
        mediaUrl: attachableMediaUrl,
      });
    }

    const contentSid = await ensureInteractiveStepContentSid({
      step: input.step,
      renderedBody,
      variables: input.variables,
    });

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
  return startCourseConversationFromEntry({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    course,
    entryModule,
    entryStep,
  });
}

async function startCourseConversationFromEntry(input: {
  contactId: string;
  contactPhone: string;
  course: Awaited<ReturnType<typeof getActiveCourseEntryStep>>["course"];
  entryModule: Awaited<ReturnType<typeof getActiveCourseEntryStep>>["entryModule"];
  entryStep: Awaited<ReturnType<typeof getActiveCourseEntryStep>>["entryStep"];
}) {
  const contextData = clearPendingCourseStepState(mergeConversationContext(null, {}));
  const conversation = await db.conversation.upsert({
    where: {
      contactId_courseId: {
        contactId: input.contactId,
        courseId: input.course.id,
      },
    },
    create: {
      contactId: input.contactId,
      courseId: input.course.id,
      selectedCourseId: input.course.id,
      currentCourseModuleId: input.entryModule.id,
      currentCourseStepId: input.entryStep.isTerminal ? null : input.entryStep.id,
      contextData,
      status: input.entryStep.isTerminal ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
    },
    update: {
      selectedCourseId: input.course.id,
      currentCourseModuleId: input.entryModule.id,
      currentCourseStepId: input.entryStep.isTerminal ? null : input.entryStep.id,
      contextData,
      status: input.entryStep.isTerminal ? "CLOSED" : "OPEN",
      lastMessageAt: new Date(),
    },
  });

  const variables = await buildConversationVariables(
    readConversationContext(contextData),
    input.entryStep,
  );

  const pauseResult = await maybePauseCourseConversationStep({
    conversationId: conversation.id,
    contactId: input.contactId,
    step: input.entryStep,
    contextData,
  });

  if (pauseResult) {
    return {
      conversation: pauseResult.conversation,
      course: input.course,
      module: input.entryModule,
      step: input.entryStep,
      providerMessageSid: null,
    };
  }

  const result = await sendCourseStep({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: conversation.id,
    step: input.entryStep,
    variables,
  });

  await db.contact.update({
    where: { id: input.contactId },
    data: { lastOutboundAt: new Date() },
  });

  return {
    conversation,
    course: input.course,
    module: input.entryModule,
    step: input.entryStep,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function startSelectedCourseConversation(input: {
  contactId: string;
  contactPhone: string;
  courseId: string;
  conversationId?: string | null;
}) {
  const { course, entryModule, entryStep } = await getCourseEntryStep(input.courseId);

  if (input.conversationId) {
    await db.conversation.delete({
      where: { id: input.conversationId },
    }).catch(() => undefined);
  }

  return startCourseConversationFromEntry({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    course,
    entryModule,
    entryStep,
  });
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
  const variables = await buildConversationVariables(readConversationContext(contextData), nextStep);

  if (nextStep.isTerminal) {
    persistCourseSurveySubmission({
      contactId: conversation.contactId,
      conversationId: conversation.id,
      courseId: nextStep.module.courseId,
      contextData: readConversationContext(contextData),
    }).catch((error: unknown) => {
      logger.error("course.survey_submission.persist_failed", {
        contactId: conversation.contactId,
        conversationId: conversation.id,
        courseId: nextStep.module.courseId,
        error,
      });
    });
  }

  const pauseResult = await maybePauseCourseConversationStep({
    conversationId: conversation.id,
    contactId: conversation.contactId,
    step: nextStep,
    contextData,
  });

  if (pauseResult) {
    return {
      conversation: pauseResult.conversation,
      nextStep,
      providerMessageSid: null,
    };
  }

  const nextStatus = nextStep.isTerminal ? "CLOSED" : "OPEN";
  const updatedConversation = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      courseId: nextStep.module.courseId,
      selectedCourseId: nextStep.module.courseId,
      currentCourseModuleId: nextStep.module.id,
      currentCourseStepId: nextStep.isTerminal ? null : nextStep.id,
      contextData: clearPendingCourseStepState(contextData),
      status: nextStatus,
      lastMessageAt: new Date(),
    },
  });

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

export async function resumePausedCourseConversation(input: {
  conversationId: string;
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
          },
        },
      },
    },
  });

  if (!conversation?.currentCourseStep) {
    return null;
  }

  const pendingState = readPendingCourseStepState(conversation.contextData);

  if (!pendingState || pendingState.stepId !== conversation.currentCourseStep.id) {
    return null;
  }

  if (pendingState.pauseUntil && pendingState.pauseUntil > new Date()) {
    return {
      conversation,
      step: conversation.currentCourseStep,
      providerMessageSid: null,
      waiting: true,
    };
  }

  const variables =
    pendingState.variables ??
    (await buildConversationVariables(
      readConversationContext(conversation.contextData),
      conversation.currentCourseStep,
    ));

  const pauseResult = await maybePauseCourseConversationStep({
    conversationId: conversation.id,
    contactId: conversation.contactId,
    step: conversation.currentCourseStep,
    contextData: clearPendingCourseStepState(conversation.contextData),
  });

  if (pauseResult) {
    return {
      conversation: pauseResult.conversation,
      step: conversation.currentCourseStep,
      providerMessageSid: null,
      waiting: true,
    };
  }

  const result = await sendCourseStep({
    contactId: conversation.contactId,
    contactPhone: input.contactPhone,
    conversationId: conversation.id,
    step: conversation.currentCourseStep,
    variables,
  });

  const nextStatus = conversation.currentCourseStep.isTerminal ? "CLOSED" : "OPEN";
  const updatedConversation = await db.conversation.update({
    where: { id: conversation.id },
    data: {
      currentCourseStepId: conversation.currentCourseStep.isTerminal
        ? null
        : conversation.currentCourseStep.id,
      contextData: clearPendingCourseStepState(conversation.contextData),
      status: nextStatus,
      lastMessageAt: new Date(),
    },
  });

  await db.contact.update({
    where: { id: conversation.contactId },
    data: { lastOutboundAt: new Date() },
  });

  return {
    conversation: updatedConversation,
    step: conversation.currentCourseStep,
    providerMessageSid: result.providerMessage.sid,
    waiting: false,
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
      selectedCourseId: course.id,
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
