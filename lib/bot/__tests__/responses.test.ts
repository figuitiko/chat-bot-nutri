import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/http";
import { ensureTemplateBody, renderTemplateBody } from "@/lib/bot/responses";

describe("renderTemplateBody", () => {
  it("replaces [key] tokens with variable values", () => {
    expect(renderTemplateBody("Hola [nombre]", { nombre: "Ana" })).toBe("Hola Ana");
  });

  it("replaces {{key}} tokens with variable values", () => {
    expect(renderTemplateBody("Hola {{nombre}}", { nombre: "Ana" })).toBe("Hola Ana");
  });

  it("replaces multiple tokens in one body", () => {
    const result = renderTemplateBody("El [dia] a las [hora]", {
      dia: "lunes",
      hora: "10:00",
    });
    expect(result).toBe("El lunes a las 10:00");
  });

  it("leaves token unchanged when variable is missing", () => {
    expect(renderTemplateBody("Hola [nombre]", {})).toBe("Hola [nombre]");
  });

  it("trims whitespace inside token keys", () => {
    expect(renderTemplateBody("Hola [ nombre ]", { nombre: "Ana" })).toBe("Hola Ana");
    expect(renderTemplateBody("Hola {{ nombre }}", { nombre: "Ana" })).toBe("Hola Ana");
  });

  it("returns body unchanged when no tokens present", () => {
    expect(renderTemplateBody("Sin variables")).toBe("Sin variables");
  });

  it("handles both token styles in the same body", () => {
    const result = renderTemplateBody("[saludo] {{nombre}}", {
      saludo: "Hola",
      nombre: "Ana",
    });
    expect(result).toBe("Hola Ana");
  });

  it("uses empty variables map when not provided", () => {
    expect(renderTemplateBody("Hola [nombre]")).toBe("Hola [nombre]");
  });
});

describe("ensureTemplateBody", () => {
  it("returns the body when it is a non-empty string", () => {
    expect(ensureTemplateBody("Hola")).toBe("Hola");
  });

  it("throws AppError for null", () => {
    expect(() => ensureTemplateBody(null)).toThrow(AppError);
  });

  it("throws AppError for undefined", () => {
    expect(() => ensureTemplateBody(undefined)).toThrow(AppError);
  });

  it("throws AppError for empty string", () => {
    expect(() => ensureTemplateBody("")).toThrow(AppError);
  });

  it("thrown error has MISSING_TEMPLATE_BODY code", () => {
    try {
      ensureTemplateBody(null);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("MISSING_TEMPLATE_BODY");
    }
  });
});
