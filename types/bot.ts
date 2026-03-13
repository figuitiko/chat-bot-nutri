export type MatchType = "EXACT" | "KEYWORD" | "CONTAINS" | "FALLBACK";

export type BotMatch = {
  flowKey: string;
  ruleId: string;
  responseTemplateKey: string;
  matchType: MatchType;
};
