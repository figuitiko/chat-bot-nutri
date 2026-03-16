import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import type { BotMatch } from "@/types/bot";

function normalizeText(text: string) {
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

function matchesPattern(matchType: string, pattern: string, text: string) {
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

export async function matchBotRule(input: {
  flowKey?: string;
  text: string;
}): Promise<BotMatch | null> {
  const flows = await db.botFlow.findMany({
    where: {
      isActive: true,
      ...(input.flowKey ? { key: input.flowKey } : {}),
    },
    include: {
      rules: {
        where: { isActive: true },
        orderBy: { priority: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (input.flowKey && flows.length === 0) {
    throw new AppError("FLOW_NOT_FOUND", `Flow "${input.flowKey}" was not found or is inactive.`, 404);
  }

  let firstFallback: BotMatch | null = null;

  for (const flow of flows) {
    const directMatch = flow.rules.find(
      (rule) => rule.matchType !== "FALLBACK" && matchesPattern(rule.matchType, rule.pattern, input.text),
    );

    if (directMatch) {
      return {
        flowKey: flow.key,
        ruleId: directMatch.id,
        responseTemplateKey: directMatch.responseTemplateKey,
        targetFlowKey: directMatch.targetFlowKey,
        matchType: directMatch.matchType,
      };
    }

    const fallback = flow.rules.find((rule) => rule.matchType === "FALLBACK");

    if (fallback && !firstFallback) {
      firstFallback = {
        flowKey: flow.key,
        ruleId: fallback.id,
        responseTemplateKey: fallback.responseTemplateKey,
        targetFlowKey: fallback.targetFlowKey,
        matchType: fallback.matchType,
      };
    }
  }

  return firstFallback;
}
