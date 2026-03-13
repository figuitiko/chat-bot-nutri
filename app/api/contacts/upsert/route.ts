import type { NextRequest } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { handleRouteError, jsonOk } from "@/lib/http";
import { upsertContactByPhone } from "@/lib/services/contacts-service";
import { upsertContactSchema } from "@/lib/validation/contact";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireApiKey(request);

    const body = upsertContactSchema.parse(await request.json());
    const contact = await upsertContactByPhone(body);

    return jsonOk({ contact });
  } catch (error) {
    return handleRouteError(error);
  }
}
