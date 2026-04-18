import { describe, expect, it } from "vitest";

import type { BotFlowTransition, BotRuleMatchType } from "@/generated/prisma/client";
import {
  matchStepTransition,
  matchesPattern,
  mergeConversationContext,
  normalizeText,
  readConversationContext,
  resolveCapturedValue,
} from "@/lib/bot/state-machine";

function makeTransition(
  matchType: BotRuleMatchType,
  pattern: string,
  outputValue: string | null = null,
): BotFlowTransition {
  return {
    id: "test-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    stepId: "step-id",
    nextStepId: null,
    matchType,
    pattern,
    outputValue,
    priority: 100,
  };
}

describe("normalizeText", () => {
  it("lowercases input", () => {
    expect(normalizeText("HOLA")).toBe("hola");
  });

  it("strips accents", () => {
    expect(normalizeText("canción")).toBe("cancion");
    expect(normalizeText("niño")).toBe("nino");
    expect(normalizeText("élite")).toBe("elite");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  hola   mundo  ")).toBe("hola mundo");
  });

  it("strips punctuation and collapses resulting spaces", () => {
    expect(normalizeText("hola, mundo!")).toBe("hola mundo");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeText("")).toBe("");
    expect(normalizeText("   ")).toBe("");
  });
});

describe("matchesPattern", () => {
  describe("EXACT", () => {
    it("matches when normalized texts are equal", () => {
      expect(matchesPattern("EXACT", "hola", "hola")).toBe(true);
      expect(matchesPattern("EXACT", "HOLA", "hola")).toBe(true);
      expect(matchesPattern("EXACT", "canción", "cancion")).toBe(true);
    });

    it("does not match when texts differ", () => {
      expect(matchesPattern("EXACT", "hola", "hola mundo")).toBe(false);
    });
  });

  describe("KEYWORD", () => {
    it("matches when pattern appears as a word in the text", () => {
      expect(matchesPattern("KEYWORD", "hola", "hola mundo")).toBe(true);
    });

    it("does not match partial words", () => {
      expect(matchesPattern("KEYWORD", "hol", "hola mundo")).toBe(false);
    });

    it("matches case-insensitively", () => {
      expect(matchesPattern("KEYWORD", "MENU", "quiero ver el menu")).toBe(true);
    });
  });

  describe("CONTAINS", () => {
    it("matches when pattern is a substring of the text", () => {
      expect(matchesPattern("CONTAINS", "buen", "buenas tardes")).toBe(true);
    });

    it("matches case-insensitively and accent-insensitively", () => {
      expect(matchesPattern("CONTAINS", "cancion", "una canción bonita")).toBe(true);
    });

    it("does not match when pattern is absent", () => {
      expect(matchesPattern("CONTAINS", "adios", "hola mundo")).toBe(false);
    });
  });

  describe("FALLBACK", () => {
    it("always matches", () => {
      expect(matchesPattern("FALLBACK", "", "anything")).toBe(true);
      expect(matchesPattern("FALLBACK", "ignored", "")).toBe(true);
    });
  });

  describe("unknown type", () => {
    it("never matches", () => {
      expect(matchesPattern("UNKNOWN", "hola", "hola")).toBe(false);
    });
  });
});

describe("matchStepTransition", () => {
  const transitions = [
    makeTransition("EXACT", "si"),
    makeTransition("EXACT", "no"),
    makeTransition("FALLBACK", ""),
  ];

  it("returns the first direct match", () => {
    const result = matchStepTransition(transitions, "si");
    expect(result?.pattern).toBe("si");
  });

  it("returns fallback when no direct match", () => {
    const result = matchStepTransition(transitions, "tal vez");
    expect(result?.matchType).toBe("FALLBACK");
  });

  it("returns null when no match and no fallback", () => {
    const noFallback = transitions.filter((t) => t.matchType !== "FALLBACK");
    const result = matchStepTransition(noFallback, "tal vez");
    expect(result).toBeNull();
  });

  it("direct match takes precedence over fallback", () => {
    const result = matchStepTransition(transitions, "no");
    expect(result?.pattern).toBe("no");
  });
});

describe("readConversationContext", () => {
  it("returns empty object for null", () => {
    expect(readConversationContext(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(readConversationContext(undefined)).toEqual({});
  });

  it("returns empty object for arrays", () => {
    expect(readConversationContext(["a", "b"])).toEqual({});
  });

  it("returns empty object for non-object primitives", () => {
    expect(readConversationContext("string")).toEqual({});
    expect(readConversationContext(42)).toEqual({});
  });

  it("converts values to strings", () => {
    const result = readConversationContext({ nombre: "Ana", edad: 30 });
    expect(result).toEqual({ nombre: "Ana", edad: "30" });
  });

  it("converts null values to empty string", () => {
    const result = readConversationContext({ campo: null });
    expect(result).toEqual({ campo: "" });
  });
});

describe("mergeConversationContext", () => {
  it("merges new values over existing context", () => {
    const base = { nombre: "Ana", ciudad: "CDMX" };
    const result = mergeConversationContext(base, { ciudad: "Monterrey" });
    expect(result).toMatchObject({ nombre: "Ana", ciudad: "Monterrey" });
  });

  it("skips undefined values", () => {
    const base = { nombre: "Ana" };
    const result = mergeConversationContext(base, { nombre: undefined });
    expect(result).toMatchObject({ nombre: "Ana" });
  });

  it("works with null base context", () => {
    const result = mergeConversationContext(null, { nombre: "Ana" });
    expect(result).toMatchObject({ nombre: "Ana" });
  });

  it("adds new keys", () => {
    const base = { nombre: "Ana" };
    const result = mergeConversationContext(base, { respuesta: "si" });
    expect(result).toMatchObject({ nombre: "Ana", respuesta: "si" });
  });
});

describe("resolveCapturedValue", () => {
  it("returns empty object when step has no captureKey", () => {
    const step = { captureKey: null };
    const transition = { outputValue: "yes" };
    expect(resolveCapturedValue(step, transition, "anything")).toEqual({});
  });

  it("uses outputValue when present", () => {
    const step = { captureKey: "respuesta" };
    const transition = { outputValue: "si" };
    expect(resolveCapturedValue(step, transition, "sí claro")).toEqual({
      respuesta: "si",
    });
  });

  it("falls back to raw text when outputValue is null", () => {
    const step = { captureKey: "respuesta" };
    const transition = { outputValue: null };
    expect(resolveCapturedValue(step, transition, "texto libre")).toEqual({
      respuesta: "texto libre",
    });
  });
});
