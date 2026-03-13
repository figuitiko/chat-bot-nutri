import type { NextRequest } from "next/server";

import { requireApiKey } from "@/lib/auth";
import { executeFlow } from "@/lib/services/flows-service";
import { handleRouteError, jsonOk } from "@/lib/http";
import { executeFlowRequestSchema } from "@/lib/validation/flow";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await requireApiKey(request);

    const body = executeFlowRequestSchema.parse(await request.json());
    const result = await executeFlow(body);

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
