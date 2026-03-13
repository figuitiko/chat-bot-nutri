import { AppError } from "@/lib/http";

const VARIABLE_TOKEN = /\[(.+?)\]|\{\{(.+?)\}\}/g;

export function renderTemplateBody(body: string, variables: Record<string, string> = {}) {
  return body.replace(VARIABLE_TOKEN, (token, squareKey, curlyKey) => {
    const key = String(squareKey ?? curlyKey ?? "").trim();
    return key ? variables[key] ?? token : token;
  });
}

export function ensureTemplateBody(body: string | null | undefined) {
  if (!body) {
    throw new AppError("MISSING_TEMPLATE_BODY", "Template body is required.", 500);
  }

  return body;
}
