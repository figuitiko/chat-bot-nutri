import { TemplateDeliveryMode, TemplateKind } from "@/generated/prisma/client";

export function buildStepBodyWithDeliveryMode(input: {
  body: string;
  deliveryMode: TemplateDeliveryMode;
  resolvedMediaUrl?: string;
}) {
  if (
    input.deliveryMode !== TemplateDeliveryMode.LINK_ONLY ||
    !input.resolvedMediaUrl ||
    input.body.includes(input.resolvedMediaUrl)
  ) {
    return input.body;
  }

  return `${input.body}\n\nRecurso: ${input.resolvedMediaUrl}`;
}

export function estimateOutboundMessagesForStep(input: {
  deliveryMode: TemplateDeliveryMode;
  kind: TemplateKind;
  hasMedia: boolean;
}) {
  if (!input.hasMedia || input.deliveryMode === TemplateDeliveryMode.LINK_ONLY) {
    return 1;
  }

  if (input.deliveryMode === TemplateDeliveryMode.MEDIA_FIRST) {
    return 2;
  }

  if (input.kind === TemplateKind.TWILIO_CONTENT_TEMPLATE) {
    return 2;
  }

  return 1;
}

export function shouldPauseForTwilioBurst(input: {
  recentOutboundCount: number;
  projectedOutboundCount: number;
  hardPauseThreshold: number;
}) {
  return input.recentOutboundCount + input.projectedOutboundCount >= input.hardPauseThreshold;
}
