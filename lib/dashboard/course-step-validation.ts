import { TemplateDeliveryMode } from '@/generated/prisma/client';

export function validateCourseStepBody(input: {
  body: string;
  deliveryMode: TemplateDeliveryMode;
  mediaUrl?: string | null;
}) {
  if (input.body.trim().length > 0) {
    return true;
  }

  const hasAttachableMedia = Boolean(input.mediaUrl?.trim());

  return hasAttachableMedia && input.deliveryMode !== TemplateDeliveryMode.LINK_ONLY;
}
