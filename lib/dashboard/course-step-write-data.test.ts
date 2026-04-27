import { describe, expect, it } from 'vitest';

import { CourseStepType, FlowStepInputType, FlowStepRenderMode, TemplateDeliveryMode, TemplateKind } from '@/generated/prisma/client';
import { buildCourseStepCreateData, buildCourseStepUpdateData } from '@/lib/dashboard/course-step-write-data';

const baseInput = {
  moduleId: 'module-1',
  title: 'Infografía residuos',
  slug: 'infografia-residuos',
  body: 'Contenido',
  stepType: CourseStepType.CONTENT,
  kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
  deliveryMode: TemplateDeliveryMode.STANDARD,
  renderMode: FlowStepRenderMode.AUTO,
  inputType: FlowStepInputType.CHOICE,
  mediaUrl: '/training-assets/foo.png',
  captureKey: null,
  assessmentKey: null,
  correctAnswer: null,
  scoreWeight: null,
  isAssessmentResult: false,
  isTerminal: false,
};

describe('course-step-write-data', () => {
  it('includes sortOrder only for create payloads', () => {
    expect(buildCourseStepCreateData(baseInput, 16).sortOrder).toBe(16);
    expect(buildCourseStepUpdateData(baseInput)).not.toHaveProperty('sortOrder');
  });

  it('normalizes optional nullable fields', () => {
    const update = buildCourseStepUpdateData({
      ...baseInput,
      mediaUrl: '',
      captureKey: '',
      assessmentKey: '',
      correctAnswer: '',
      scoreWeight: undefined,
    });

    expect(update.mediaUrl).toBeNull();
    expect(update.captureKey).toBeNull();
    expect(update.assessmentKey).toBeNull();
    expect(update.correctAnswer).toBeNull();
    expect(update.scoreWeight).toBeNull();
  });
});
