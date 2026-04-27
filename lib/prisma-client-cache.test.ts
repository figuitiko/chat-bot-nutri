import { describe, expect, it } from "vitest";

import { shouldReusePrismaClient } from "@/lib/prisma-client-cache";

describe("shouldReusePrismaClient", () => {
  it("returns false when the cached client is missing required delegates", () => {
    expect(shouldReusePrismaClient({})).toBe(false);
    expect(shouldReusePrismaClient({ contact: {} })).toBe(false);
  });

  it("returns true when the cached client exposes the expected delegates", () => {
    expect(
      shouldReusePrismaClient({
        contact: {},
        conversation: {},
        courseSurveySubmission: {},
      }),
    ).toBe(true);
  });
});
