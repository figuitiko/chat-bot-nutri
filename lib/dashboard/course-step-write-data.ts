import type { Prisma } from '@/generated/prisma/client';

interface StepWriteInput {
  moduleId: string;
  title: string;
  slug: string;
  body: string;
  stepType: Prisma.CourseStepUncheckedCreateInput['stepType'];
  kind: Prisma.CourseStepUncheckedCreateInput['kind'];
  deliveryMode: Prisma.CourseStepUncheckedCreateInput['deliveryMode'];
  renderMode: Prisma.CourseStepUncheckedCreateInput['renderMode'];
  inputType: Prisma.CourseStepUncheckedCreateInput['inputType'];
  mediaUrl?: string | null;
  captureKey?: string | null;
  assessmentKey?: string | null;
  correctAnswer?: string | null;
  scoreWeight?: number | null;
  isAssessmentResult: boolean;
  isTerminal: boolean;
}

function normalizeOptional(value?: string | null) {
  return value && value.length > 0 ? value : null;
}

function buildBaseStepData(input: StepWriteInput) {
  return {
    moduleId: input.moduleId,
    title: input.title,
    slug: input.slug,
    body: input.body,
    stepType: input.stepType,
    kind: input.kind,
    deliveryMode: input.deliveryMode,
    renderMode: input.renderMode,
    inputType: input.inputType,
    mediaUrl: normalizeOptional(input.mediaUrl),
    captureKey: normalizeOptional(input.captureKey),
    assessmentKey: normalizeOptional(input.assessmentKey),
    correctAnswer: normalizeOptional(input.correctAnswer),
    scoreWeight: input.scoreWeight ?? null,
    isAssessmentResult: input.isAssessmentResult,
    isTerminal: input.isTerminal,
    isActive: true,
  } satisfies Omit<Prisma.CourseStepUncheckedCreateInput, 'sortOrder'>;
}

export function buildCourseStepCreateData(
  input: StepWriteInput,
  sortOrder: number,
): Prisma.CourseStepUncheckedCreateInput {
  return {
    ...buildBaseStepData(input),
    sortOrder,
  };
}

export function buildCourseStepUpdateData(
  input: StepWriteInput,
): Prisma.CourseStepUncheckedUpdateInput {
  return buildBaseStepData(input);
}
