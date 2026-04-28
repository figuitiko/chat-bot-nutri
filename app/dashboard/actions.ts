"use server";

import { put } from "@vercel/blob";
import {
  BotRuleMatchType,
  CourseStatus,
  CourseStepType,
  FlowStepInputType,
  FlowStepRenderMode,
  TemplateDeliveryMode,
  TemplateKind,
  type Prisma,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import { setContactAccessSecret } from "@/lib/services/access-service";
import { buildReorderUpdates } from "@/lib/dashboard/course-reorder";
import {
  buildCourseStepCreateData,
  buildCourseStepUpdateData,
} from "@/lib/dashboard/course-step-write-data";
import { slugify } from "@/lib/utils";

const courseInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(CourseStatus),
});

const moduleInputSchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  summary: z.string().optional(),
});

const stepInputSchema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  stepId: z.string().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  body: z.string().min(1),
  stepType: z.nativeEnum(CourseStepType),
  kind: z.nativeEnum(TemplateKind),
  deliveryMode: z.nativeEnum(TemplateDeliveryMode),
  renderMode: z.nativeEnum(FlowStepRenderMode),
  inputType: z.nativeEnum(FlowStepInputType),
  mediaUrl: z.string().optional(),
  captureKey: z.string().optional(),
  assessmentKey: z.string().optional(),
  correctAnswer: z.string().optional(),
  scoreWeight: z.coerce.number().int().min(0).max(100).optional(),
  isAssessmentResult: z.coerce.boolean().default(false),
  isTerminal: z.coerce.boolean().default(false),
});

const transitionInputSchema = z.object({
  courseId: z.string().min(1),
  stepId: z.string().min(1),
  nextStepId: z.string().min(1),
  matchType: z.nativeEnum(BotRuleMatchType),
  pattern: z.string().min(1),
  displayLabel: z.string().optional(),
  displayHint: z.string().optional(),
  outputValue: z.string().optional(),
  priority: z.coerce.number().int().min(1).default(100),
});

const contactInputSchema = z.object({
  phone: z.string().min(8),
  name: z.string().trim().optional(),
  profileName: z.string().trim().optional(),
  locale: z.string().trim().default("es-MX"),
});

const secretInputSchema = z.object({
  contactId: z.string().min(1),
  secret: z.string().trim().min(6),
});

const enrollmentInputSchema = z.object({
  contactId: z.string().min(1),
  courseId: z.string().min(1),
});

function redirectToCourse(
  courseId: string,
  editorState?: { moduleSlug?: string | null; stepSlug?: string | null; saved?: boolean },
) {
  const params = new URLSearchParams();
  if (editorState?.moduleSlug) params.set("module", editorState.moduleSlug);
  if (editorState?.stepSlug) params.set("step", editorState.stepSlug);
  if (editorState?.saved) params.set("saved", "1");
  const query = params.toString();
  const url = `/dashboard/courses/${courseId}${query ? `?${query}` : ""}#step-editor`;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}`);
  redirect(url);
}

function getEditorState(formData: FormData) {
  const moduleSlug = String(formData.get("moduleSlug") ?? "").trim() || null;
  const stepSlug = String(formData.get("stepSlug") ?? "").trim() || null;

  return { moduleSlug, stepSlug };
}

function redirectToContact(contactId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${contactId}`);
  redirect(`/dashboard/contacts/${contactId}`);
}

async function validateCourseActivation(courseId: string) {
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        include: {
          steps: {
            include: {
              transitions: {
                where: { isActive: true },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new AppError("COURSE_NOT_FOUND", "El curso no existe.", 404);
  }

  if (course.modules.length === 0) {
    throw new AppError(
      "COURSE_INVALID",
      "El curso debe tener al menos un modulo.",
      422,
    );
  }

  const steps = course.modules.flatMap((module) => module.steps);

  if (steps.length === 0) {
    throw new AppError(
      "COURSE_INVALID",
      "El curso debe tener al menos un paso.",
      422,
    );
  }

  for (const step of steps) {
    if (
      step.deliveryMode === "MEDIA_FIRST" &&
      !step.mediaUrl &&
      !step.mediaAssetId
    ) {
      throw new AppError(
        "COURSE_INVALID",
        `El paso "${step.title}" usa MEDIA_FIRST pero no tiene un asset configurado.`,
        422,
      );
    }

    if (!step.isTerminal && step.transitions.length === 0) {
      throw new AppError(
        "COURSE_INVALID",
        `El paso "${step.title}" necesita al menos una transicion.`,
        422,
      );
    }
  }

  const assessmentSteps = steps.filter((step) => step.assessmentKey);
  const assessmentKeys = new Set(
    assessmentSteps.map((step) => step.assessmentKey),
  );

  for (const assessmentKey of assessmentKeys) {
    if (!assessmentKey) {
      continue;
    }

    const questions = steps.filter(
      (step) =>
        step.assessmentKey === assessmentKey &&
        step.correctAnswer &&
        step.captureKey,
    );
    const results = steps.filter(
      (step) => step.assessmentKey === assessmentKey && step.isAssessmentResult,
    );
    const totalWeight = questions.reduce(
      (sum, step) => sum + (step.scoreWeight ?? 0),
      0,
    );

    if (questions.length === 0 || results.length === 0) {
      throw new AppError(
        "COURSE_INVALID",
        `La evaluacion "${assessmentKey}" necesita preguntas y un paso de resultado.`,
        422,
      );
    }

    if (totalWeight <= 0) {
      throw new AppError(
        "COURSE_INVALID",
        `La evaluacion "${assessmentKey}" necesita puntajes mayores a cero.`,
        422,
      );
    }
  }
}

export async function createCourseAction(formData: FormData) {
  await requireAdminSession();

  const input = courseInputSchema.parse({
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    status: formData.get("status") || CourseStatus.DRAFT,
  });

  const course = await db.course.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: input.status,
      isActive: false,
    },
  });

  redirectToCourse(course.id);
}

export async function updateCourseAction(formData: FormData) {
  await requireAdminSession();

  const input = courseInputSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    description: formData.get("description"),
    status: formData.get("status"),
  });

  if (!input.id) {
    throw new AppError(
      "COURSE_NOT_FOUND",
      "Falta el identificador del curso.",
      422,
    );
  }

  await db.course.update({
    where: { id: input.id },
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: input.status,
    },
  });

  redirectToCourse(input.id, getEditorState(formData));
}

export async function activateCourseAction(formData: FormData) {
  await requireAdminSession();
  const courseId = String(formData.get("courseId") ?? "");

  await validateCourseActivation(courseId);

  await db.$transaction([
    db.course.updateMany({
      where: {
        isActive: true,
        id: { not: courseId },
      },
      data: {
        isActive: false,
        activatedAt: null,
        status: CourseStatus.DRAFT,
      },
    }),
    db.course.update({
      where: { id: courseId },
      data: {
        isActive: true,
        activatedAt: new Date(),
        archivedAt: null,
        status: CourseStatus.ACTIVE,
      },
    }),
  ]);

  redirectToCourse(courseId, getEditorState(formData));
}

export async function archiveCourseAction(formData: FormData) {
  await requireAdminSession();
  const courseId = String(formData.get("courseId") ?? "");

  await db.course.update({
    where: { id: courseId },
    data: {
      status: CourseStatus.ARCHIVED,
      archivedAt: new Date(),
      isActive: false,
      activatedAt: null,
    },
  });

  revalidatePath("/dashboard/courses");
  redirect("/dashboard/courses");
}

export async function createOrUpdateModuleAction(formData: FormData) {
  await requireAdminSession();

  const input = moduleInputSchema.parse({
    courseId: formData.get("courseId"),
    moduleId: formData.get("moduleId"),
    title: formData.get("title"),
    slug: slugify(String(formData.get("slug") || formData.get("title") || "")),
    summary: formData.get("summary"),
  });

  if (input.moduleId) {
    await db.courseModule.update({
      where: { id: input.moduleId },
      data: {
        title: input.title,
        slug: input.slug,
        summary: input.summary,
      },
    });
  } else {
    const sortOrder = await db.courseModule.count({
      where: { courseId: input.courseId },
    });

    await db.courseModule.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        slug: input.slug,
        summary: input.summary,
        sortOrder: sortOrder + 1,
      },
    });
  }

  redirectToCourse(input.courseId, getEditorState(formData));
}

export async function createOrUpdateStepAction(formData: FormData) {
  await requireAdminSession();

  const input = stepInputSchema.parse({
    courseId: formData.get("courseId"),
    moduleId: formData.get("moduleId"),
    stepId: formData.get("stepId"),
    title: formData.get("title"),
    slug: slugify(String(formData.get("slug") || formData.get("title") || "")),
    body: formData.get("body"),
    stepType: formData.get("stepType"),
    kind: formData.get("kind"),
    deliveryMode: formData.get("deliveryMode"),
    renderMode: formData.get("renderMode"),
    inputType: formData.get("inputType"),
    mediaUrl: formData.get("mediaUrl"),
    captureKey: formData.get("captureKey"),
    assessmentKey: formData.get("assessmentKey"),
    correctAnswer: formData.get("correctAnswer"),
    scoreWeight: formData.get("scoreWeight") || undefined,
    isAssessmentResult: formData.get("isAssessmentResult") === "on",
    isTerminal: formData.get("isTerminal") === "on",
  });

  const stepInput = {
    moduleId: input.moduleId,
    title: input.title,
    slug: input.slug,
    body: input.body,
    stepType: input.stepType,
    kind: input.kind,
    deliveryMode: input.deliveryMode,
    renderMode: input.renderMode,
    inputType: input.inputType,
    mediaUrl: input.mediaUrl,
    captureKey: input.captureKey,
    assessmentKey: input.assessmentKey,
    correctAnswer: input.correctAnswer,
    scoreWeight: input.scoreWeight,
    isAssessmentResult: input.isAssessmentResult,
    isTerminal: input.isTerminal,
  };

  if (input.stepId) {
    await db.$transaction([
      db.courseStep.update({
        where: { id: input.stepId },
        data: buildCourseStepUpdateData(stepInput),
      }),
      db.messageTemplate.updateMany({
        where: { key: input.slug },
        data: { twilioContentSid: null },
      }),
    ]);

    redirectToCourse(input.courseId, {
      moduleSlug: getEditorState(formData).moduleSlug,
      stepSlug: input.slug,
      saved: true,
    });
    return;
  }

  const sortOrder = await db.courseStep.count({
    where: { moduleId: input.moduleId },
  });

  await db.courseStep.create({
    data: {
      ...buildCourseStepCreateData(stepInput, sortOrder + 1),
    },
  });

  redirectToCourse(input.courseId, {
    moduleSlug: getEditorState(formData).moduleSlug,
    stepSlug: input.slug,
  });
}

export async function updateTransitionAction(formData: FormData) {
  await requireAdminSession();

  const transitionId = String(formData.get("transitionId") ?? "");
  if (!transitionId) throw new AppError("MISSING_TRANSITION_ID", "transitionId required", 400);

  const input = transitionInputSchema.parse({
    courseId: formData.get("courseId"),
    stepId: formData.get("stepId"),
    nextStepId: formData.get("nextStepId"),
    matchType: formData.get("matchType"),
    pattern: formData.get("pattern"),
    displayLabel: formData.get("displayLabel"),
    displayHint: formData.get("displayHint"),
    outputValue: formData.get("outputValue"),
    priority: formData.get("priority") || 100,
  });

  await db.courseTransition.update({
    where: { id: transitionId },
    data: {
      nextStepId: input.nextStepId,
      matchType: input.matchType,
      pattern: input.pattern,
      displayLabel: input.displayLabel || null,
      displayHint: input.displayHint || null,
      outputValue: input.outputValue || null,
      priority: input.priority,
    },
  });

  redirectToCourse(input.courseId, { ...getEditorState(formData), saved: true });
}

export async function deleteTransitionAction(formData: FormData) {
  await requireAdminSession();

  const transitionId = String(formData.get("transitionId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!transitionId) throw new AppError("MISSING_TRANSITION_ID", "transitionId required", 400);

  await db.courseTransition.delete({ where: { id: transitionId } });

  redirectToCourse(courseId, getEditorState(formData));
}

export async function createTransitionAction(formData: FormData) {
  await requireAdminSession();

  const input = transitionInputSchema.parse({
    courseId: formData.get("courseId"),
    stepId: formData.get("stepId"),
    nextStepId: formData.get("nextStepId"),
    matchType: formData.get("matchType"),
    pattern: formData.get("pattern"),
    displayLabel: formData.get("displayLabel"),
    displayHint: formData.get("displayHint"),
    outputValue: formData.get("outputValue"),
    priority: formData.get("priority") || 100,
  });

  await db.courseTransition.create({
    data: {
      stepId: input.stepId,
      nextStepId: input.nextStepId,
      matchType: input.matchType,
      pattern: input.pattern,
      displayLabel: input.displayLabel || null,
      displayHint: input.displayHint || null,
      outputValue: input.outputValue || null,
      priority: input.priority,
      isActive: true,
    },
  });

  redirectToCourse(input.courseId, getEditorState(formData));
}

export async function deleteStepAction(formData: FormData) {
  await requireAdminSession();

  const courseId = String(formData.get("courseId") ?? "");
  const stepId = String(formData.get("stepId") ?? "");
  const moduleSlug = String(formData.get("moduleSlug") ?? "");

  if (!stepId) throw new AppError("MISSING_STEP_ID", "stepId required", 400);

  await db.$transaction([
    db.courseTransition.deleteMany({ where: { nextStepId: stepId } }),
    db.courseStep.delete({ where: { id: stepId } }),
  ]);

  redirectToCourse(courseId, { moduleSlug });
}

export async function deleteModuleAction(formData: FormData) {
  await requireAdminSession();

  const courseId = String(formData.get("courseId") ?? "");
  const moduleId = String(formData.get("moduleId") ?? "");

  if (!moduleId) throw new AppError("MISSING_MODULE_ID", "moduleId required", 400);

  const stepIds = await db.courseStep
    .findMany({ where: { moduleId }, select: { id: true } })
    .then((rows) => rows.map((r) => r.id));

  await db.$transaction([
    db.courseTransition.deleteMany({ where: { nextStepId: { in: stepIds } } }),
    db.courseModule.delete({ where: { id: moduleId } }),
  ]);

  redirectToCourse(courseId);
}

export async function reorderStepsAction(moduleId: string, orderedIds: string[]) {
  await requireAdminSession();

  const updates = buildReorderUpdates(orderedIds);

  await db.$transaction(
    updates.map(({ id, sortOrder }) =>
      db.courseStep.update({ where: { id }, data: { sortOrder } }),
    ),
  );
}

export async function reorderModulesAction(courseId: string, orderedIds: string[]) {
  await requireAdminSession();

  const updates = buildReorderUpdates(orderedIds);

  await db.$transaction(
    updates.map(({ id, sortOrder }) =>
      db.courseModule.update({ where: { id }, data: { sortOrder } }),
    ),
  );
}

export async function clearCourseTwilioCacheAction(formData: FormData) {
  await requireAdminSession();

  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) throw new AppError("MISSING_COURSE_ID", "courseId required", 400);

  const slugs = await db.courseStep
    .findMany({ where: { module: { courseId } }, select: { slug: true } })
    .then((rows) => rows.map((r) => r.slug));

  await db.messageTemplate.updateMany({
    where: { key: { in: slugs } },
    data: { twilioContentSid: null },
  });

  revalidatePath(`/dashboard/courses/${courseId}`);
  redirect(`/dashboard/courses/${courseId}`);
}

export async function uploadAssetAction(formData: FormData) {
  await requireAdminSession();

  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new AppError(
      "BLOB_NOT_CONFIGURED",
      "Configura BLOB_READ_WRITE_TOKEN para subir archivos desde el dashboard.",
      500,
    );
  }

  const file = formData.get("file");
  const courseId = String(formData.get("courseId") ?? "");
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  const kind = String(formData.get("kind") ?? "OTHER");

  if (!(file instanceof File) || file.size === 0) {
    throw new AppError("INVALID_FILE", "Selecciona un archivo valido.", 422);
  }

  const pathname = `courses/${courseId}/${Date.now()}-${file.name}`;
  const blob = await put(pathname, file, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  const asset = await db.asset.create({
    data: {
      kind: kind as Prisma.AssetCreateInput["kind"],
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type || null,
      sizeBytes: file.size,
    },
  });

  if (targetType === "course") {
    await db.course.update({
      where: { id: targetId },
      data: { coverAssetId: asset.id },
    });
  } else if (targetType === "module") {
    await db.courseModule.update({
      where: { id: targetId },
      data: { introAssetId: asset.id },
    });
  } else if (targetType === "step") {
    await db.courseStep.update({
      where: { id: targetId },
      data: {
        mediaAssetId: asset.id,
        mediaUrl: blob.url,
      },
    });
  }

  redirectToCourse(courseId, getEditorState(formData));
}

export async function createContactAction(formData: FormData) {
  await requireAdminSession();

  const input = contactInputSchema.parse({
    phone: formData.get("phone"),
    name: formData.get("name"),
    profileName: formData.get("profileName"),
    locale: formData.get("locale") || "es-MX",
  });

  const contact = await upsertContactByPhone(input);
  redirectToContact(contact.id);
}

export async function deleteContactAction(formData: FormData) {
  await requireAdminSession();

  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) throw new AppError("MISSING_CONTACT_ID", "contactId required", 400);

  await db.contact.delete({ where: { id: contactId } });

  revalidatePath("/dashboard/contacts");
  redirect("/dashboard/contacts");
}

export async function updateContactAction(formData: FormData) {
  await requireAdminSession();

  const contactId = String(formData.get("contactId") ?? "");
  const input = contactInputSchema.parse({
    phone: formData.get("phone"),
    name: formData.get("name"),
    profileName: formData.get("profileName"),
    locale: formData.get("locale") || "es-MX",
  });

  await db.contact.update({
    where: { id: contactId },
    data: {
      phone: normalizePhone(input.phone),
      name: input.name || null,
      profileName: input.profileName || null,
      locale: input.locale,
    },
  });

  redirectToContact(contactId);
}

export async function setContactSecretAction(formData: FormData) {
  await requireAdminSession();

  const input = secretInputSchema.parse({
    contactId: formData.get("contactId"),
    secret: formData.get("secret"),
  });

  await setContactAccessSecret(input);
  redirectToContact(input.contactId);
}

export async function assignCourseEnrollmentAction(formData: FormData) {
  await requireAdminSession();

  const input = enrollmentInputSchema.parse({
    contactId: formData.get("contactId"),
    courseId: formData.get("courseId"),
  });

  await db.courseEnrollment.upsert({
    where: {
      contactId_courseId: {
        contactId: input.contactId,
        courseId: input.courseId,
      },
    },
    create: {
      contactId: input.contactId,
      courseId: input.courseId,
      isActive: true,
    },
    update: {
      isActive: true,
      completedAt: null,
    },
  });

  redirectToContact(input.contactId);
}

export async function revokeCourseEnrollmentAction(formData: FormData) {
  await requireAdminSession();

  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");

  await db.courseEnrollment.update({
    where: { id: enrollmentId },
    data: {
      isActive: false,
    },
  });

  redirectToContact(contactId);
}
