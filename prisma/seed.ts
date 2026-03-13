import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { BotRuleMatchType, PrismaClient, TemplateKind } from "../generated/prisma/client";

import { sha256 } from "@/lib/crypto";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the Prisma seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

async function main() {
  const templates = [
    {
      key: "welcome",
      name: "Bienvenida",
      body: "Hola, soy el asistente virtual. Responde con: 1) Precios 2) Horarios 3) Ubicacion 4) Hablar con un asesor",
      kind: TemplateKind.TEXT,
    },
    {
      key: "pricing",
      name: "Precios",
      body: "Con gusto te compartimos nuestros precios. Si deseas una cotizacion personalizada, responde ASESOR.",
      kind: TemplateKind.TEXT,
    },
    {
      key: "hours",
      name: "Horarios",
      body: "Nuestro horario es de lunes a viernes de 9:00 a 18:00.",
      kind: TemplateKind.TEXT,
    },
    {
      key: "location",
      name: "Ubicacion",
      body: "Estamos ubicados en [DIRECCION].",
      kind: TemplateKind.TEXT,
    },
    {
      key: "human_handoff",
      name: "Transferencia humana",
      body: "Perfecto, uno de nuestros asesores te contactara en breve.",
      kind: TemplateKind.TEXT,
    },
    {
      key: "appointment_reminder",
      name: "Recordatorio de cita",
      body: "Te recordamos tu cita para {{fecha}} a las {{hora}}. Si necesitas reprogramar, responde CAMBIO.",
      kind: TemplateKind.TEXT,
    },
    {
      key: "payment_reminder",
      name: "Recordatorio de pago",
      body: "Te recordamos que tienes un pago pendiente por {{monto}} con vencimiento {{fecha}}.",
      kind: TemplateKind.TEXT,
    },
  ];

  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: template,
    });
  }

  const flows = [
    {
      key: "welcome",
      name: "Flujo de bienvenida",
      description: "Respuesta inicial y menu principal.",
      fallbackTemplateKey: "welcome",
      rules: [
        { matchType: BotRuleMatchType.EXACT, pattern: "hola", responseTemplateKey: "welcome", priority: 1 },
        { matchType: BotRuleMatchType.EXACT, pattern: "menu", responseTemplateKey: "welcome", priority: 2 },
        { matchType: BotRuleMatchType.FALLBACK, pattern: "*", responseTemplateKey: "welcome", priority: 999 },
      ],
    },
    {
      key: "pricing",
      name: "Flujo de precios",
      description: "Consultas sobre precios y cotizaciones.",
      fallbackTemplateKey: "pricing",
      rules: [
        { matchType: BotRuleMatchType.EXACT, pattern: "1", responseTemplateKey: "pricing", priority: 1 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "precio", responseTemplateKey: "pricing", priority: 2 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "precios", responseTemplateKey: "pricing", priority: 3 },
      ],
    },
    {
      key: "hours",
      name: "Flujo de horarios",
      description: "Horario de atencion.",
      fallbackTemplateKey: "hours",
      rules: [
        { matchType: BotRuleMatchType.EXACT, pattern: "2", responseTemplateKey: "hours", priority: 1 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "horario", responseTemplateKey: "hours", priority: 2 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "horarios", responseTemplateKey: "hours", priority: 3 },
      ],
    },
    {
      key: "location",
      name: "Flujo de ubicacion",
      description: "Ubicacion y direccion.",
      fallbackTemplateKey: "location",
      rules: [
        { matchType: BotRuleMatchType.EXACT, pattern: "3", responseTemplateKey: "location", priority: 1 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "ubicacion", responseTemplateKey: "location", priority: 2 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "direccion", responseTemplateKey: "location", priority: 3 },
      ],
    },
    {
      key: "human_handoff",
      name: "Flujo de asesor",
      description: "Escalacion a humano.",
      fallbackTemplateKey: "human_handoff",
      rules: [
        { matchType: BotRuleMatchType.EXACT, pattern: "4", responseTemplateKey: "human_handoff", priority: 1 },
        { matchType: BotRuleMatchType.KEYWORD, pattern: "asesor", responseTemplateKey: "human_handoff", priority: 2 },
        { matchType: BotRuleMatchType.CONTAINS, pattern: "hablar con", responseTemplateKey: "human_handoff", priority: 3 },
      ],
    },
    {
      key: "appointment_reminder",
      name: "Recordatorio de cita",
      description: "Recordatorio programatico de citas.",
      fallbackTemplateKey: "appointment_reminder",
      rules: [],
    },
    {
      key: "payment_reminder",
      name: "Recordatorio de pago",
      description: "Recordatorio programatico de pagos.",
      fallbackTemplateKey: "payment_reminder",
      rules: [],
    },
  ];

  for (const flow of flows) {
    const { rules, ...flowData } = flow;
    const botFlow = await prisma.botFlow.upsert({
      where: { key: flow.key },
      create: flowData,
      update: flowData,
    });

    await prisma.botRule.deleteMany({
      where: {
        flowId: botFlow.id,
      },
    });

    if (rules.length > 0) {
      await prisma.botRule.createMany({
        data: rules.map((rule) => ({
          flowId: botFlow.id,
          ...rule,
        })),
      });
    }
  }

  if (process.env.INTERNAL_API_KEY) {
    const keyHash = sha256(process.env.INTERNAL_API_KEY);

    await prisma.apiKey.upsert({
      where: { keyHash },
      create: {
        name: "bootstrap",
        keyHash,
      },
      update: {
        isActive: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
