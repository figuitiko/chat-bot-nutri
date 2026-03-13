import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/http";
import { matchBotRule } from "@/lib/bot/matcher";
import { executeFlow, sendTemplateByKey } from "@/lib/services/flows-service";

export async function executeTemplateOrFlow(input: {
  contactPhone: string;
  templateKey?: string;
  flowKey?: string;
  variables?: Record<string, string>;
}) {
  if (input.flowKey && !input.templateKey) {
    return executeFlow({
      contactPhone: input.contactPhone,
      flowKey: input.flowKey,
      variables: input.variables,
    });
  }

  if (!input.templateKey) {
    throw new AppError("MISSING_TEMPLATE", "Template key is required.", 422);
  }

  const contact = await db.contact.findUnique({
    where: {
      phone: input.contactPhone,
    },
  });

  if (!contact) {
    throw new AppError("CONTACT_NOT_FOUND", "Contact must exist before sending a template.", 404);
  }

  const result = await sendTemplateByKey({
    contactId: contact.id,
    contactPhone: input.contactPhone,
    templateKey: input.templateKey,
    variables: input.variables,
  });

  await db.contact.update({
    where: { id: contact.id },
    data: {
      lastOutboundAt: new Date(),
    },
  });

  return {
    contact,
    template: result.template,
    message: result.persisted,
    providerMessageSid: result.providerMessage.sid,
  };
}

export async function resolveInboundResponse(text: string, flowKey?: string) {
  const match = await matchBotRule({ flowKey, text });

  if (!match) {
    logger.warn("bot.no_match", { text, flowKey });
    return null;
  }

  return match;
}
