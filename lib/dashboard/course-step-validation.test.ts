import { describe, expect, it } from 'vitest';

import { TemplateDeliveryMode } from '@/generated/prisma/client';
import { validateCourseStepBody } from '@/lib/dashboard/course-step-validation';

describe('validateCourseStepBody', () => {
  it('allows an empty body for media attachment steps', () => {
    expect(
      validateCourseStepBody({
        body: '',
        deliveryMode: TemplateDeliveryMode.MEDIA_FIRST,
        mediaUrl: 'https://example.com/welcome.png',
      }),
    ).toBe(true);

    expect(
      validateCourseStepBody({
        body: '',
        deliveryMode: TemplateDeliveryMode.STANDARD,
        mediaUrl: 'https://example.com/welcome.png',
      }),
    ).toBe(true);
  });

  it('rejects an empty body when there is no attachable media', () => {
    expect(
      validateCourseStepBody({
        body: '',
        deliveryMode: TemplateDeliveryMode.STANDARD,
        mediaUrl: '',
      }),
    ).toBe(false);
  });

  it('rejects an empty body for LINK_ONLY steps because the link needs text context', () => {
    expect(
      validateCourseStepBody({
        body: '',
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        mediaUrl: 'https://example.com/manual.pdf',
      }),
    ).toBe(false);
  });
});
