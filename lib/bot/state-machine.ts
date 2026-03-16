import type {
  BotFlowStep,
  BotFlowTransition,
  Prisma,
} from "@/generated/prisma/client";

export function normalizeText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeText(text: string) {
  return normalizeText(text).split(" ").filter(Boolean);
}

export function matchesPattern(matchType: string, pattern: string, text: string) {
  const normalizedPattern = normalizeText(pattern);
  const normalizedText = normalizeText(text);

  switch (matchType) {
    case "EXACT":
      return normalizedText === normalizedPattern;
    case "KEYWORD":
      return tokenizeText(text).includes(normalizedPattern);
    case "CONTAINS":
      return normalizedText.includes(normalizedPattern);
    case "FALLBACK":
      return true;
    default:
      return false;
  }
}

export function matchStepTransition<T extends BotFlowTransition>(transitions: T[], text: string) {
  const directMatch = transitions.find(
    (transition) =>
      transition.matchType !== "FALLBACK" &&
      matchesPattern(transition.matchType, transition.pattern, text),
  );

  if (directMatch) {
    return directMatch;
  }

  return transitions.find((transition) => transition.matchType === "FALLBACK") ?? null;
}

export function readConversationContext(
  contextData: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
) {
  if (!contextData || typeof contextData !== "object" || Array.isArray(contextData)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(contextData).map(([key, value]) => [key, String(value ?? "")]),
  );
}

export function mergeConversationContext(
  existingContext: Prisma.JsonValue | Prisma.InputJsonValue | null | undefined,
  updates: Record<string, string | undefined>,
): Prisma.InputJsonValue {
  const base = readConversationContext(existingContext);
  const merged: Record<string, string> = { ...base };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

export function resolveCapturedValue(
  step: Pick<BotFlowStep, "captureKey">,
  transition: Pick<BotFlowTransition, "outputValue">,
  text: string,
) {
  if (!step.captureKey) {
    return {};
  }

  return {
    [step.captureKey]: transition.outputValue ?? text.trim(),
  };
}
