import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { INTERNAL_API_KEY_HEADER } from "@/lib/constants";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export async function requireApiKey(request: NextRequest) {
  const apiKey = request.headers.get(INTERNAL_API_KEY_HEADER);

  if (!apiKey) {
    throw new AppError("UNAUTHORIZED", "Missing API key.", 401);
  }

  if (safeEqual(apiKey, env.INTERNAL_API_KEY)) {
    return { source: "env" as const, name: "bootstrap" };
  }

  const keyHash = sha256(apiKey);
  const storedKey = await db.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!storedKey) {
    throw new AppError("UNAUTHORIZED", "Invalid API key.", 401);
  }

  return { source: "database" as const, ...storedKey };
}

export function hashApiKey(apiKey: string) {
  return sha256(apiKey);
}
