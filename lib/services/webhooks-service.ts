import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/http";
import { normalizeText } from "@/lib/bot/state-machine";
import { resolveInboundResponse } from "@/lib/bot/executor";
import { parseWhatsAppAddress } from "@/lib/phone";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import {
  findOpenConversation,
  getConversationAccessState,
  hasActiveEnrollmentForCourse,
  handleSecretSubmission,
  promptCourseSelectionAgain,
  resolveSelectedCourseId,
  startAccessConversation,
} from "@/lib/services/access-service";
import {
  dispatchDeferredCourseFollowUp,
  progressCourseConversation,
  restartCourseConversation,
  resumePausedCourseConversation,
  startSelectedCourseConversation,
} from "@/lib/services/course-runtime-service";
import {
  progressConversation,
  restartConversation,
  startFlowConversation,
  sendTemplateByKey,
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

async function closeAllOpenConversations(contactId: string) {
  await db.conversation.updateMany({
    where: {
      contactId,
      status: "OPEN",
    },
    data: {
      status: "CLOSED",
      currentStepId: null,
      currentCourseStepId: null,
      currentCourseModuleId: null,
      lastMessageAt: new Date(),
    },
  });
}

type InboundContact = Awaited<ReturnType<typeof upsertContactByPhone>>;
type OpenConversation = Awaited<ReturnType<typeof findOpenConversation>>;
type GlobalCommand = ReturnType<typeof resolveGlobalCommand>;

type InboundRoutingContext = {
  contact: InboundContact;
  contactPhone: string;
  inboundInput: string;
  openConversation: OpenConversation;
  activeCourseConversation: OpenConversation;
  activeLegacyConversation: OpenConversation;
  accessState: ReturnType<typeof getConversationAccessState>;
  globalCommand: GlobalCommand;
};

type InboundRoutingState = {
  replied: boolean;
  conversationId: string | null;
  matchedFlowKey: string | null;
  matchedTemplateKey: string | null;
  responseMessageSid: string | null;
};

function createRoutingState(openConversation: OpenConversation): InboundRoutingState {
  return {
    replied: false,
    conversationId: openConversation?.id ?? null,
    matchedFlowKey: openConversation?.courseId ?? openConversation?.flowId ?? null,
    matchedTemplateKey:
      openConversation?.currentCourseStepId ?? openConversation?.currentStepId ?? null,
    responseMessageSid: null,
  };
}

function createRoutingContext(input: {
  contact: InboundContact;
  contactPhone: string;
  inboundInput: string;
  openConversation: OpenConversation;
}): InboundRoutingContext {
  return {
    contact: input.contact,
    contactPhone: input.contactPhone,
    inboundInput: input.inboundInput,
    openConversation: input.openConversation,
    activeCourseConversation:
      input.openConversation?.courseId && input.openConversation.currentCourseStepId
        ? input.openConversation
        : null,
    activeLegacyConversation:
      input.openConversation?.flowId && input.openConversation.currentStepId
        ? input.openConversation
        : null,
    accessState: getConversationAccessState(input.openConversation?.contextData),
    globalCommand: resolveGlobalCommand(input.inboundInput),
  };
}

async function ensureInboundMessageIsNotDuplicate(providerMessageSid?: string) {
  if (!providerMessageSid) {
    return false;
  }

  const existingMessage = await db.message.findUnique({
    where: { providerMessageSid },
    select: { id: true },
  });

  if (!existingMessage) {
    return false;
  }

  logger.info("webhook.inbound.duplicate", { providerMessageSid });
  return true;
}

async function registerInboundEvent(
  payload: Record<string, string | undefined>,
  providerMessageSid?: string,
) {
  const eventId = providerMessageSid ? `inbound:${providerMessageSid}` : undefined;
  await upsertWebhookEvent({
    source: "TWILIO_INBOUND",
    eventId,
    payload,
    status: "RECEIVED",
  });

  return eventId;
}

async function resolveInboundContact(payload: Record<string, string | undefined>) {
  const contactPhone = parseWhatsAppAddress(payload.From);
  const contact = await upsertContactByPhone({
    phone: contactPhone,
    waId: payload.WaId,
    profileName: payload.ProfileName,
  });

  return { contact, contactPhone };
}

async function startAccessPrompt(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  const started = await startAccessConversation({
    contactId: context.contact.id,
    contactPhone: context.contactPhone,
  });

  state.conversationId = started.conversation.id;
  state.matchedFlowKey = null;
  state.matchedTemplateKey = "auth_secret_prompt";
  state.responseMessageSid = started.providerMessageSid;
  state.replied = true;
}

async function handleGlobalCommand(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  if (context.globalCommand === "menu") {
    await closeAllOpenConversations(context.contact.id);
    await startAccessPrompt(context, state);
    return;
  }

  if (context.globalCommand === "restart" && context.activeCourseConversation) {
    const hasEnrollment = await hasActiveEnrollmentForCourse({
      contactId: context.contact.id,
      courseId: context.activeCourseConversation.courseId!,
    });

    if (!hasEnrollment) {
      await closeAllOpenConversations(context.contact.id);
      await startAccessPrompt(context, state);
      return;
    }

    const restarted = await restartCourseConversation({
      conversationId: context.activeCourseConversation.id,
      contactPhone: context.contactPhone,
    });

    state.conversationId = restarted.conversation.id;
    state.matchedFlowKey = restarted.course.slug;
    state.matchedTemplateKey = restarted.step.slug;
    state.responseMessageSid = restarted.providerMessageSid;
    state.replied = true;
    return;
  }

  if (context.globalCommand === "restart" && context.activeLegacyConversation) {
    const restarted = await restartConversation({
      conversationId: context.activeLegacyConversation.id,
      contactPhone: context.contactPhone,
    });

    state.conversationId = restarted.conversation.id;
    state.matchedFlowKey = restarted.flow.key;
    state.matchedTemplateKey = restarted.step.templateKey;
    state.responseMessageSid = restarted.providerMessageSid;
    state.replied = true;
    return;
  }

  if (context.globalCommand === "restart") {
    await closeAllOpenConversations(context.contact.id);
    await startAccessPrompt(context, state);
    return;
  }

  if (context.globalCommand === "cancel") {
    await closeAllOpenConversations(context.contact.id);

    const response = await sendTemplateByKey({
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      templateKey: "conversation_cancelled",
      conversationId: state.conversationId,
    });

    state.matchedTemplateKey = "conversation_cancelled";
    state.responseMessageSid = response.providerMessage.sid;
    state.conversationId = null;
    state.replied = true;
  }
}

async function handleAccessRouting(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  if (context.accessState === "awaiting_secret" && context.openConversation) {
    const result = await handleSecretSubmission({
      conversationId: context.openConversation.id,
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      secret: context.inboundInput,
    });

    state.conversationId = result.conversationId;
    state.responseMessageSid = result.providerMessageSid;
    state.matchedTemplateKey =
      result.selectedCourseId ? "course_selected" : "auth_secret_submission";
    state.replied = true;

    if (result.selectedCourseId) {
      const started = await startSelectedCourseConversation({
        contactId: context.contact.id,
        contactPhone: context.contactPhone,
        courseId: result.selectedCourseId,
        conversationId: result.conversationId,
      });

      state.conversationId = started.conversation.id;
      state.matchedFlowKey = started.course.slug;
      state.matchedTemplateKey = started.step.slug;
      state.responseMessageSid = started.providerMessageSid;
    }
  }

  if (state.replied || context.accessState !== "awaiting_course_selection" || !context.openConversation) {
    return;
  }

  const selectedCourseId = await resolveSelectedCourseId({
    contactId: context.contact.id,
    text: context.inboundInput,
  });

  if (selectedCourseId) {
    const started = await startSelectedCourseConversation({
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      courseId: selectedCourseId,
      conversationId: context.openConversation.id,
    });

    state.conversationId = started.conversation.id;
    state.matchedFlowKey = started.course.slug;
    state.matchedTemplateKey = started.step.slug;
    state.responseMessageSid = started.providerMessageSid;
  } else {
    const response = await promptCourseSelectionAgain({
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      conversationId: context.openConversation.id,
    });

    state.conversationId = context.openConversation.id;
    state.matchedTemplateKey = "auth_course_selection";
    state.responseMessageSid = response?.sid ?? null;
  }

  state.replied = true;
}

async function handleCourseEngine(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  if (!context.activeCourseConversation) {
    return;
  }

  const hasEnrollment = await hasActiveEnrollmentForCourse({
    contactId: context.contact.id,
    courseId: context.activeCourseConversation.courseId!,
  });

  if (!hasEnrollment) {
    await db.conversation.update({
      where: { id: context.activeCourseConversation.id },
      data: {
        status: "CLOSED",
        currentCourseModuleId: null,
        currentCourseStepId: null,
        lastMessageAt: new Date(),
      },
    });

    await startAccessPrompt(context, state);
    return;
  }

  const resumed = await resumePausedCourseConversation({
    conversationId: context.activeCourseConversation.id,
    contactPhone: context.contactPhone,
  });

  if (resumed) {
    state.conversationId = resumed.conversation.id;
    state.matchedFlowKey = resumed.step.module.courseId;
    state.matchedTemplateKey = resumed.step.slug;
    state.responseMessageSid = resumed.providerMessageSid;
    state.replied = true;
    return;
  }

  const progressed = await progressCourseConversation({
    conversationId: context.activeCourseConversation.id,
    text: context.inboundInput,
    contactPhone: context.contactPhone,
  });

  if (!progressed) {
    return;
  }

  state.conversationId = progressed.conversation.id;
  state.matchedFlowKey = progressed.nextStep.module.courseId;
  state.matchedTemplateKey = progressed.nextStep.slug;
  state.responseMessageSid = progressed.providerMessageSid;
  state.replied = true;
}

async function handleLegacyEngine(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  if (!context.activeLegacyConversation) {
    return;
  }

  const progressed = await progressConversation({
    conversationId: context.activeLegacyConversation.id,
    text: context.inboundInput,
    contactPhone: context.contactPhone,
  });

  if (!progressed) {
    return;
  }

  state.conversationId = progressed.conversation.id;
  state.matchedFlowKey = progressed.nextStep.flowId;
  state.matchedTemplateKey = progressed.nextStep.templateKey;
  state.responseMessageSid = progressed.providerMessageSid;
  state.replied = true;
}

async function handleRuleRouting(
  context: InboundRoutingContext,
  state: InboundRoutingState,
) {
  const match = await resolveInboundResponse(context.inboundInput);

  if (match?.targetFlowKey) {
    const started = await startFlowConversation({
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      flowKey: match.targetFlowKey,
    });

    state.conversationId = started.conversation.id;
    state.matchedFlowKey = started.flow.key;
    state.matchedTemplateKey = started.step.templateKey;
    state.responseMessageSid = started.providerMessageSid;
    state.replied = true;
    return;
  }

  if (match?.responseTemplateKey) {
    const response = await sendTemplateByKey({
      contactId: context.contact.id,
      contactPhone: context.contactPhone,
      templateKey: match.responseTemplateKey,
      conversationId: state.conversationId,
    });

    state.matchedFlowKey = match.flowKey;
    state.matchedTemplateKey = match.responseTemplateKey;
    state.responseMessageSid = response.providerMessage.sid;
    state.replied = true;
  }
}

async function finalizeInboundWebhook(input: {
  payload: Record<string, string | undefined>;
  providerMessageSid?: string;
  eventId?: string;
  contactId: string;
  state: InboundRoutingState;
}) {
  const inboundMessage = await storeInboundMessage({
    body: input.payload.Body ?? "",
    contactId: input.contactId,
    conversationId: input.state.conversationId,
    providerMessageSid: input.providerMessageSid,
    rawPayload: input.payload,
  });

  if (!input.state.replied && input.state.conversationId) {
    await db.conversation.update({
      where: { id: input.state.conversationId },
      data: {
        status: "ESCALATED",
      },
    });
  }

  await Promise.all([
    db.contact.update({
      where: { id: input.contactId },
      data: {
        lastInboundAt: new Date(),
        ...(input.state.replied ? { lastOutboundAt: new Date() } : {}),
      },
    }),
    input.eventId
      ? db.webhookEvent.update({
          where: {
            source_eventId: {
              source: "TWILIO_INBOUND",
              eventId: input.eventId,
            },
          },
          data: {
            processedAt: new Date(),
            status: "PROCESSED",
          },
        })
      : Promise.resolve(),
  ]);

  return inboundMessage;
}

export async function processInboundWebhook(payload: Record<string, string | undefined>) {
  const providerMessageSid = payload.MessageSid ?? payload.SmsSid;

  if (await ensureInboundMessageIsNotDuplicate(providerMessageSid)) {
    return { duplicate: true, replied: false };
  }

  const eventId = await registerInboundEvent(payload, providerMessageSid);
  const { contact, contactPhone } = await resolveInboundContact(payload);
  const inboundInput = resolveInboundInput(payload);
  const openConversation = await findOpenConversation(contact.id);
  const context = createRoutingContext({
    contact,
    contactPhone,
    inboundInput,
    openConversation,
  });
  const state = createRoutingState(openConversation);

  await handleGlobalCommand(context, state);
  if (!state.replied) {
    await handleAccessRouting(context, state);
  }
  if (!state.replied) {
    await handleCourseEngine(context, state);
  }
  if (!state.replied) {
    await handleLegacyEngine(context, state);
  }
  // Rule routing only for contacts actively inside a course or legacy flow.
  // Access-flow states (awaiting_secret, awaiting_course_selection, verified) are
  // already handled above; let them fall through to startAccessPrompt if needed.
  const hasActiveSession =
    context.activeCourseConversation ||
    context.activeLegacyConversation;
  if (!state.replied && hasActiveSession) {
    await handleRuleRouting(context, state);
  }
  if (!state.replied) {
    // Only start the auth prompt if the contact has an active credential.
    // Contacts with no credential or an inactive one are silently dropped —
    // they cannot authenticate and should not be prompted to try.
    const credential = await db.contactAccessCredential.findUnique({
      where: { contactId: contact.id },
      select: { isActive: true },
    });
    if (credential?.isActive) {
      await startAccessPrompt(context, state);
    }
  }

  const inboundMessage = await finalizeInboundWebhook({
    payload,
    providerMessageSid,
    eventId,
    contactId: contact.id,
    state,
  });

  return {
    duplicate: false,
    replied: state.replied,
    contactId: contact.id,
    inboundMessageId: inboundMessage.id,
    matchedFlowKey: state.matchedFlowKey,
    matchedTemplateKey: state.matchedTemplateKey,
    responseMessageSid: state.responseMessageSid,
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
      contactId: true,
      conversationId: true,
      templateKey: true,
      rawPayload: true,
      status: true,
    },
  });

  if (!message) {
    throw new AppError("MESSAGE_NOT_FOUND", "Provider message SID was not found.", 404);
  }

  const nextStatus = mapTwilioStatus(messageStatus);
  const messageRawPayload =
    message.rawPayload && typeof message.rawPayload === "object" && !Array.isArray(message.rawPayload)
      ? (message.rawPayload as Record<string, unknown>)
      : {};
  const deferredFollowUp =
    messageRawPayload.deferredFollowUp &&
    typeof messageRawPayload.deferredFollowUp === "object" &&
    !Array.isArray(messageRawPayload.deferredFollowUp)
      ? (messageRawPayload.deferredFollowUp as Record<string, unknown>)
      : null;

  await Promise.all([
    db.message.update({
      where: { id: message.id },
      data: {
        status: nextStatus,
        errorCode: payload.ErrorCode ?? null,
        errorMessage: payload.ErrorMessage ?? null,
        rawPayload: {
          ...messageRawPayload,
          statusCallbackPayload: payload,
        },
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

  const shouldDispatchFollowUp =
    deferredFollowUp &&
    ["SENT", "DELIVERED"].includes(nextStatus) &&
    !deferredFollowUp.dispatchedAt;

  if (shouldDispatchFollowUp) {
    const followUpEventId = `followup:${messageSid}`;
    const existingFollowUpEvent = await db.webhookEvent.findUnique({
      where: {
        source_eventId: {
          source: "TWILIO_STATUS",
          eventId: followUpEventId,
        },
      },
      select: { id: true },
    });

    if (!existingFollowUpEvent) {
      await upsertWebhookEvent({
        source: "TWILIO_STATUS",
        eventId: followUpEventId,
        payload: deferredFollowUp as Prisma.InputJsonValue,
        status: "RECEIVED",
      });

      const followUpType = String(deferredFollowUp.type ?? "");
      const templateKey = String(deferredFollowUp.templateKey ?? "");

      if (followUpType === "course-step") {
        const courseStepId =
          typeof deferredFollowUp.courseStepId === "string"
            ? deferredFollowUp.courseStepId
            : undefined;

        if (courseStepId) {
          await dispatchDeferredCourseFollowUp({
            contactId: message.contactId,
            contactPhone: parseWhatsAppAddress(payload.To),
            courseStepId,
            conversationId: message.conversationId,
            variables:
              deferredFollowUp.variables &&
              typeof deferredFollowUp.variables === "object" &&
              !Array.isArray(deferredFollowUp.variables)
                ? Object.fromEntries(
                    Object.entries(deferredFollowUp.variables as Record<string, unknown>).map(
                      ([key, value]) => [key, String(value ?? "")],
                    ),
                  )
                : undefined,
          });
        }
      }

      if (followUpType === "template" && templateKey) {
        const stepId =
          typeof deferredFollowUp.stepId === "string" ? deferredFollowUp.stepId : undefined;
        const step = stepId
          ? await db.botFlowStep.findUnique({
              where: { id: stepId },
              include: {
                transitions: {
                  where: { isActive: true },
                  orderBy: { priority: "asc" },
                },
              },
            })
          : null;

        await sendTemplateByKey({
          contactId: message.contactId,
          contactPhone: parseWhatsAppAddress(payload.To),
          templateKey,
          conversationId: message.conversationId,
          variables:
            deferredFollowUp.variables &&
            typeof deferredFollowUp.variables === "object" &&
            !Array.isArray(deferredFollowUp.variables)
              ? Object.fromEntries(
                  Object.entries(deferredFollowUp.variables as Record<string, unknown>).map(
                    ([key, value]) => [key, String(value ?? "")],
                  ),
                )
              : undefined,
          step: step ?? undefined,
          skipMedia: true,
        });
      }

      if (followUpType === "text" && templateKey) {
        await sendTemplateByKey({
          contactId: message.contactId,
          contactPhone: parseWhatsAppAddress(payload.To),
          templateKey,
          conversationId: message.conversationId,
          skipMedia: true,
        });
      }

      await Promise.all([
        db.message.update({
          where: { id: message.id },
          data: {
            rawPayload: {
              ...messageRawPayload,
              deferredFollowUp: {
                ...deferredFollowUp,
                dispatchedAt: new Date().toISOString(),
              },
              statusCallbackPayload: payload,
            },
          },
        }),
        db.webhookEvent.update({
          where: {
            source_eventId: {
              source: "TWILIO_STATUS",
              eventId: followUpEventId,
            },
          },
          data: {
            processedAt: new Date(),
            status: "PROCESSED",
          },
        }),
      ]);
    }
  }

  return {
    duplicate: false,
    messageId: message.id,
    previousStatus: message.status,
    nextStatus,
  };
}
