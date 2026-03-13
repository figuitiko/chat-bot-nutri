import type { NextRequest } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { executeTemplateOrFlow } from "@/lib/bot/executor";
import { handleRouteError, jsonOk } from "@/lib/http";
import { normalizePhone } from "@/lib/phone";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import { sendMessageRequestSchema } from "@/lib/validation/message";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireApiKey(request);

    const body = sendMessageRequestSchema.parse(await request.json());
    const contactPhone = normalizePhone(body.contactPhone);

    await upsertContactByPhone({ phone: contactPhone });

    const result = await executeTemplateOrFlow({
      contactPhone,
      templateKey: body.templateKey,
      flowKey: body.flowKey,
      variables: body.variables,
    });

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
