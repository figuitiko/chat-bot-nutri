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

function redirectToCourse(courseId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/courses");
  revalidatePath(`/dashboard/courses/${courseId}`);
  redirect(`/dashboard/courses/${courseId}`);
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
    throw new AppError("COURSE_INVALID", "El curso debe tener al menos un modulo.", 422);
  }

  const steps = course.modules.flatMap((module) => module.steps);

  if (steps.length === 0) {
    throw new AppError("COURSE_INVALID", "El curso debe tener al menos un paso.", 422);
  }

  for (const step of steps) {
    if (step.deliveryMode === "MEDIA_FIRST" && !step.mediaUrl && !step.mediaAssetId) {
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
  const assessmentKeys = new Set(assessmentSteps.map((step) => step.assessmentKey));

  for (const assessmentKey of assessmentKeys) {
    if (!assessmentKey) {
      continue;
    }

    const questions = steps.filter(
      (step) => step.assessmentKey === assessmentKey && step.correctAnswer && step.captureKey,
    );
    const results = steps.filter(
      (step) => step.assessmentKey === assessmentKey && step.isAssessmentResult,
    );
    const totalWeight = questions.reduce((sum, step) => sum + (step.scoreWeight ?? 0), 0);

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
    throw new AppError("COURSE_NOT_FOUND", "Falta el identificador del curso.", 422);
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

  redirectToCourse(input.id);
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

  redirectToCourse(courseId);
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

  redirectToCourse(input.courseId);
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

  const data: Prisma.CourseStepUncheckedCreateInput = {
    moduleId: input.moduleId,
    title: input.title,
    slug: input.slug,
    body: input.body,
    stepType: input.stepType,
    kind: input.kind,
    deliveryMode: input.deliveryMode,
    renderMode: input.renderMode,
    inputType: input.inputType,
    mediaUrl: input.mediaUrl || null,
    captureKey: input.captureKey || null,
    assessmentKey: input.assessmentKey || null,
    correctAnswer: input.correctAnswer || null,
    scoreWeight: input.scoreWeight ?? null,
    isAssessmentResult: input.isAssessmentResult,
    isTerminal: input.isTerminal,
    isActive: true,
    sortOrder: 1,
  };

  if (input.stepId) {
    await db.courseStep.update({
      where: { id: input.stepId },
      data,
    });
  } else {
    const sortOrder = await db.courseStep.count({
      where: { moduleId: input.moduleId },
    });

    await db.courseStep.create({
      data: {
        ...data,
        sortOrder: sortOrder + 1,
      },
    });
  }

  redirectToCourse(input.courseId);
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

  redirectToCourse(input.courseId);
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

  redirectToCourse(courseId);
}
