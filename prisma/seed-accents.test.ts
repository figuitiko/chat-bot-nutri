import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const seedLines = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8")
  .split("\n")
  .filter((line) => /\b(name|title|summary|description|body):\s*"/.test(line));

const forbiddenPatterns = [
  /\bCapacitacion\b/,
  /\bcapacitacion\b/,
  /\bModulo\b/,
  /\bmodulo\b/,
  /\bmodulos\b/,
  /\baqui\b/,
  /\bdia\b/,
  /\bhigienico\b/,
  /\bhigienicamente\b/,
  /\bevaluacion\b/,
  /\bintroduccion\b/,
  /\bcontaminacion\b/,
  /\bdesinfeccion\b/,
  /\binstitucion\b/,
  /\bfisico\b/,
  /\bpracticas\b/,
  /\banos\b/,
  /\bano\b/,
  /\bimagenes\b/,
  /\binfografia\b/,
  /\binfografias\b/,
  /\batencion\b/,
  /\bconversacion\b/,
  /\bnutricion\b/,
  /\balimentacion\b/,
  /\bpreparacion\b/,
  /\btecnica\b/,
  /\banonima\b/,
  /\bacademica\b/,
  /\bdias\b/,
  /\bcontinuacion\b/,
];

describe("seed spanish accents", () => {
  it("does not leave common user-facing words without accents in visible copy fields", () => {
    const offendingLines = seedLines.filter((line) =>
      forbiddenPatterns.some((pattern) => pattern.test(line)),
    );

    expect(offendingLines).toEqual([]);
  });
});
