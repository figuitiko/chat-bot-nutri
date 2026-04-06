import "server-only";

import { compare, hash } from "bcryptjs";
import {
  MessageStatus,
  MessageType,
  type Prisma,
  type Course,
} from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { normalizeText } from "@/lib/bot/state-machine";
import { storeOutboundMessage } from "@/lib/services/messages-service";
import {
  createWhatsAppInteractiveTemplate,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type WhatsAppInteractiveOption,
} from "@/lib/twilio";

const MAX_FAILED_SECRET_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type AccessState = "awaiting_secret" | "awaiting_course_selection" | "verified";

function readContextValue(
  contextData: unknown,
  key: string,
) {
  if (!contextData || typeof contextData !== "object" || Array.isArray(contextData)) {
    return undefined;
  }

  const value = (contextData as Record<string, unknown>)[key];
  return value === undefined || value === null ? undefined : String(value);
}

function mergeAccessContext(
  contextData: unknown,
  updates: Record<string, string | null | undefined>,
): Prisma.InputJsonValue {
  const base =
    contextData && typeof contextData === "object" && !Array.isArray(contextData)
      ? { ...(contextData as Record<string, unknown>) }
      : {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      continue;
    }

    if (value === null) {
      delete base[key];
      continue;
    }

    base[key] = value;
  }

  return base as Prisma.InputJsonValue;
}

function getCourseChoiceLabel(course: Pick<Course, "name">, index: number) {
  return `${index + 1}`;
}

function getCourseChoiceHint(course: Pick<Course, "name">) {
  return course.name;
}

async function sendAccessTextMessage(input: {
  contactId: string;
  contactPhone: string;
  conversationId?: string | null;
  body: string;
  templateKey: string;
}) {
  const providerMessage = await sendWhatsAppTextMessage({
    to: input.contactPhone,
    body: input.body,
  });

  await storeOutboundMessage({
    body: input.body,
    contactId: input.contactId,
    conversationId: input.conversationId,
    providerMessageSid: providerMessage.sid,
    rawPayload: providerMessage,
    status: MessageStatus.QUEUED,
    templateKey: input.templateKey,
    messageType: MessageType.TEXT,
  });

  return providerMessage;
}

async function sendAccessSelectionMessage(input: {
  contactId: string;
  contactPhone: string;
  conversationId: string;
  courses: Array<Pick<Course, "id" | "name" | "slug">>;
}) {
  const body = [
    "Tu acceso fue verificado.",
    "Selecciona el curso que quieres tomar ahora:",
    ...input.courses.map((course, index) => `${index + 1}) ${course.name}`),
  ].join("\n");

  const options: WhatsAppInteractiveOption[] = input.courses.map((course, index) => ({
    id: `course:${course.id}`,
    title: getCourseChoiceLabel(course, index),
    description: getCourseChoiceHint(course),
  }));

  const mode =
    options.length <= 3 ? "quick-reply" : options.length <= 10 ? "list-picker" : null;

  if (!mode) {
    return sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body,
      templateKey: "auth_course_selection",
    });
  }

  const content = await createWhatsAppInteractiveTemplate({
    friendlyName: `course-selection-${input.contactId}-${Date.now()}`,
    language: "es-MX",
    body,
    mode,
    options,
  });

  const providerMessage = await sendWhatsAppTemplateMessage({
    to: input.contactPhone,
    contentSid: content.sid,
  });

  await storeOutboundMessage({
    body,
    contactId: input.contactId,
    conversationId: input.conversationId,
    providerMessageSid: providerMessage.sid,
    rawPayload: providerMessage,
    status: MessageStatus.QUEUED,
    templateKey: "auth_course_selection",
    messageType: MessageType.TEMPLATE,
  });

  return providerMessage;
}

export async function setContactAccessSecret(input: { contactId: string; secret: string }) {
  const secretHash = await hash(input.secret, 10);

  return db.contactAccessCredential.upsert({
    where: { contactId: input.contactId },
    create: {
      contactId: input.contactId,
      secretHash,
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: null,
      isActive: true,
    },
    update: {
      secretHash,
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: null,
      isActive: true,
    },
  });
}

export async function getActiveEnrollmentsForContact(contactId: string) {
  return db.courseEnrollment.findMany({
    where: {
      contactId,
      isActive: true,
      course: {
        status: "ACTIVE",
      },
    },
    include: {
      course: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function hasActiveEnrollmentForCourse(input: {
  contactId: string;
  courseId: string;
}) {
  const enrollment = await db.courseEnrollment.findFirst({
    where: {
      contactId: input.contactId,
      courseId: input.courseId,
      isActive: true,
      course: {
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(enrollment);
}

export async function findOpenConversation(contactId: string) {
  return db.conversation.findFirst({
    where: {
      contactId,
      status: "OPEN",
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function startAccessConversation(input: {
  contactId: string;
  contactPhone: string;
}) {
  const existing = await db.conversation.findFirst({
    where: {
      contactId: input.contactId,
      courseId: null,
      flowId: null,
      status: "OPEN",
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const conversation = existing
    ? await db.conversation.update({
        where: { id: existing.id },
        data: {
          flowId: null,
          courseId: null,
          selectedCourseId: null,
          currentCourseModuleId: null,
          currentCourseStepId: null,
          currentStepId: null,
          contextData: {
            authState: "awaiting_secret",
          },
          status: "OPEN",
          lastMessageAt: new Date(),
        },
      })
    : await db.conversation.create({
        data: {
          contactId: input.contactId,
          flowId: null,
          courseId: null,
          selectedCourseId: null,
          currentCourseModuleId: null,
          currentCourseStepId: null,
          currentStepId: null,
          contextData: {
            authState: "awaiting_secret",
          },
          status: "OPEN",
          lastMessageAt: new Date(),
        },
      });

  const providerMessage = await sendAccessTextMessage({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: conversation.id,
    body: "Hola. Para continuar, escribe tu clave de acceso.",
    templateKey: "auth_secret_prompt",
  });

  return { conversation, providerMessageSid: providerMessage.sid };
}

export async function handleSecretSubmission(input: {
  conversationId: string;
  contactId: string;
  contactPhone: string;
  secret: string;
}) {
  const credential = await db.contactAccessCredential.findUnique({
    where: { contactId: input.contactId },
  });

  if (!credential || !credential.isActive) {
    await sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body: "Tu numero no tiene acceso configurado. Contacta al administrador.",
      templateKey: "auth_no_credential",
    });

    return {
      verified: false,
      conversationId: input.conversationId,
      providerMessageSid: null,
    } as const;
  }

  if (credential.lockedUntil && credential.lockedUntil > new Date()) {
    await sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body: "Tu acceso esta bloqueado temporalmente. Intenta nuevamente mas tarde.",
      templateKey: "auth_locked",
    });

    return {
      verified: false,
      conversationId: input.conversationId,
      providerMessageSid: null,
    } as const;
  }

  const isValid = await compare(input.secret, credential.secretHash);

  if (!isValid) {
    const failedAttempts = credential.failedAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_SECRET_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : null;

    await db.contactAccessCredential.update({
      where: { contactId: input.contactId },
      data: {
        failedAttempts,
        lockedUntil,
      },
    });

    const providerMessage = await sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body: shouldLock
        ? "Clave invalida. Tu acceso quedo bloqueado temporalmente."
        : "Clave invalida. Intenta nuevamente.",
      templateKey: "auth_invalid_secret",
    });

    logger.warn("auth.secret.invalid", {
      contactId: input.contactId,
      failedAttempts,
      lockedUntil: lockedUntil?.toISOString(),
    });

    return {
      verified: false,
      conversationId: input.conversationId,
      providerMessageSid: providerMessage.sid,
    } as const;
  }

  await db.contactAccessCredential.update({
    where: { contactId: input.contactId },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: new Date(),
    },
  });

  const enrollments = await getActiveEnrollmentsForContact(input.contactId);

  if (enrollments.length === 0) {
    await db.conversation.update({
      where: { id: input.conversationId },
      data: {
        contextData: mergeAccessContext(null, {
          authState: "verified",
        }),
        lastMessageAt: new Date(),
      },
    });

    const providerMessage = await sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body: "Tu acceso fue verificado, pero no tienes cursos activos asignados.",
      templateKey: "auth_no_enrollments",
    });

    return {
      verified: true,
      conversationId: input.conversationId,
      enrollments,
      providerMessageSid: providerMessage.sid,
    } as const;
  }

  if (enrollments.length === 1) {
    await db.conversation.update({
      where: { id: input.conversationId },
      data: {
        selectedCourseId: enrollments[0].courseId,
        contextData: mergeAccessContext(null, {
          authState: "verified",
          selectedCourseId: enrollments[0].courseId,
        }),
        lastMessageAt: new Date(),
      },
    });

    return {
      verified: true,
      conversationId: input.conversationId,
      enrollments,
      selectedCourseId: enrollments[0].courseId,
      providerMessageSid: null,
    } as const;
  }

  await db.conversation.update({
    where: { id: input.conversationId },
    data: {
      selectedCourseId: null,
      contextData: mergeAccessContext(null, {
        authState: "awaiting_course_selection",
      }),
      lastMessageAt: new Date(),
    },
  });

  const providerMessage = await sendAccessSelectionMessage({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: input.conversationId,
    courses: enrollments.map((enrollment) => enrollment.course),
  });

  return {
    verified: true,
    conversationId: input.conversationId,
    enrollments,
    providerMessageSid: providerMessage.sid,
  } as const;
}

export async function resolveSelectedCourseId(input: {
  contactId: string;
  text: string;
}) {
  const enrollments = await getActiveEnrollmentsForContact(input.contactId);
  const normalized = normalizeText(input.text);

  if (normalized.startsWith("course:")) {
    const selected = enrollments.find((enrollment) => `course:${enrollment.courseId}` === normalized);
    return selected?.courseId ?? null;
  }

  const numericIndex = Number(normalized);
  if (Number.isInteger(numericIndex) && numericIndex > 0 && numericIndex <= enrollments.length) {
    return enrollments[numericIndex - 1]?.courseId ?? null;
  }

  const bySlug = enrollments.find((enrollment) => enrollment.course.slug === normalized);
  if (bySlug) {
    return bySlug.courseId;
  }

  const byName = enrollments.find(
    (enrollment) => normalizeText(enrollment.course.name) === normalized,
  );
  if (byName) {
    return byName.courseId;
  }

  return null;
}

export async function promptCourseSelectionAgain(input: {
  contactId: string;
  contactPhone: string;
  conversationId: string;
}) {
  const enrollments = await getActiveEnrollmentsForContact(input.contactId);

  if (enrollments.length === 0) {
    const providerMessage = await sendAccessTextMessage({
      contactId: input.contactId,
      contactPhone: input.contactPhone,
      conversationId: input.conversationId,
      body: "No tienes cursos activos asignados en este momento.",
      templateKey: "auth_no_enrollments",
    });
    return providerMessage;
  }

  return sendAccessSelectionMessage({
    contactId: input.contactId,
    contactPhone: input.contactPhone,
    conversationId: input.conversationId,
    courses: enrollments.map((enrollment) => enrollment.course),
  });
}

export function getConversationAccessState(contextData: unknown): AccessState | null {
  const authState = readContextValue(contextData, "authState");
  if (
    authState === "awaiting_secret" ||
    authState === "awaiting_course_selection" ||
    authState === "verified"
  ) {
    return authState;
  }

  return null;
}
