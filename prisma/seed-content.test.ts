import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const seedSource = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");

function getTemplateBlock(key: string) {
  const pattern = new RegExp(`\\{\\s*key: "${key}",[\\s\\S]*?\\n  \\},`, "m");
  const match = seedSource.match(pattern);
  if (!match) {
    throw new Error(`Template ${key} not found in prisma/seed.ts`);
  }
  return match[0];
}

describe("nutri seed delivery compaction", () => {
  it("keeps interactive CTA templates where the learner should still see a button", () => {
    expect(getTemplateBlock("training_module_1_intro")).toContain(
      "kind: TemplateKind.TWILIO_CONTENT_TEMPLATE",
    );
    expect(getTemplateBlock("training_module_1_intro")).toContain(
      'mediaUrl: "/training-assets/modulo-1-conceptos-basicos.png"',
    );
  });

  it("keeps interactive checkpoints where the learner should tap instead of type", () => {
    expect(getTemplateBlock("training_materials_intro")).toContain(
      "kind: TemplateKind.TWILIO_CONTENT_TEMPLATE",
    );
    expect(getTemplateBlock("training_hygiene_summary")).toContain(
      "kind: TemplateKind.TWILIO_CONTENT_TEMPLATE",
    );
    expect(getTemplateBlock("training_module_2_quiz_intro")).toContain(
      "kind: TemplateKind.TWILIO_CONTENT_TEMPLATE",
    );
    expect(getTemplateBlock("training_evaluation_intro")).toContain(
      "kind: TemplateKind.TWILIO_CONTENT_TEMPLATE",
    );
  });

  it("uses LINK_ONLY for resource-heavy steps without losing interactive buttons", () => {
    for (const key of [
      "training_food_handling_audio",
      "training_cleaning_audio",
      "training_drying_video",
      "training_cross_contamination_audio",
      "training_module_2_intro",
      "training_module_2_rules_video",
      "training_module_2_peps_audio",
      "training_module_2_storage_video",
      "training_module_3_manual",
      "training_module_3_audio",
      "training_module_3_minutario",
      "training_module_3_menu_video",
      "training_module_4_intro",
    ]) {
      expect(getTemplateBlock(key)).toContain("kind: TemplateKind.TWILIO_CONTENT_TEMPLATE");
      expect(getTemplateBlock(key)).toContain("deliveryMode: TemplateDeliveryMode.LINK_ONLY");
    }
  });

  it("keeps button-based CTA steps interactive even when they include images", () => {
    for (const key of [
      "training_eta_activity",
      "training_module_2_waste_infographic",
      "training_module_2_pests_infographic",
      "training_module_2_fruit_wash_infographic",
      "training_module_3_intro",
      "training_module_3_healthy_eating",
      "training_module_4_survey_intro",
    ]) {
      expect(getTemplateBlock(key)).toContain("kind: TemplateKind.TWILIO_CONTENT_TEMPLATE");
    }
  });
});
