const REQUIRED_PRISMA_DELEGATES = [
  "contact",
  "conversation",
  "courseSurveySubmission",
] as const;

export function shouldReusePrismaClient(client: unknown) {
  if (!client || typeof client !== "object") {
    return false;
  }

  return REQUIRED_PRISMA_DELEGATES.every((delegate) => delegate in client);
}
