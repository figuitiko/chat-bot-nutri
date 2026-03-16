import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  BotRuleMatchType,
  FlowStepInputType,
  PrismaClient,
  TemplateKind,
} from "../generated/prisma/client";

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

type SeedRule = {
  matchType: BotRuleMatchType;
  pattern: string;
  priority: number;
  responseTemplateKey?: string;
  targetFlowKey?: string;
};

type SeedStep = {
  key: string;
  name: string;
  templateKey: string;
  inputType: FlowStepInputType;
  captureKey?: string;
  isTerminal: boolean;
};

type SeedTransition = {
  stepKey: string;
  matchType: BotRuleMatchType;
  pattern: string;
  nextStepKey: string;
  nextFlowKey?: string;
  outputValue?: string;
  priority: number;
};

type SeedFlow = {
  key: string;
  name: string;
  description: string;
  entryStepKey: string;
  fallbackTemplateKey: string;
  rules: SeedRule[];
  steps: SeedStep[];
  transitions: SeedTransition[];
};

const templates = [
  {
    key: "welcome",
    name: "Bienvenida",
    body: "Hola, soy el asistente virtual. Responde con: 1) Precios 2) Horarios 3) Ubicacion 4) Hablar con un asesor 5) Crear un curso",
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
  {
    key: "course_creation_intro",
    name: "Curso - nombre",
    body: "Vamos a crear tu curso. Cual es el nombre del curso?",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_category",
    name: "Curso - categoria",
    body: "Perfecto. Que categoria deseas? 1) Programacion 2) Diseno 3) Marketing",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_level",
    name: "Curso - nivel",
    body: "Que nivel tendra el curso? 1) Basico 2) Intermedio 3) Avanzado",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_duration",
    name: "Curso - duracion",
    body: "Cuanto durara el curso? Puedes responder algo como 4 semanas o 12 horas.",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_price",
    name: "Curso - precio",
    body: "Cual sera el precio del curso? Ejemplo: 1999 MXN",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_confirm",
    name: "Curso - confirmacion",
    body: "Confirma los datos del curso:\nNombre: {{courseName}}\nCategoria: {{courseCategory}}\nNivel: {{courseLevel}}\nDuracion: {{courseDuration}}\nPrecio: {{coursePrice}}\n\nResponde: 1) Confirmar 2) Reiniciar 3) Hablar con un asesor",
    kind: TemplateKind.TEXT,
  },
  {
    key: "course_creation_completed",
    name: "Curso - completado",
    body: "Listo. Tu solicitud para crear el curso \"{{courseName}}\" fue registrada correctamente.",
    kind: TemplateKind.TEXT,
  },
  {
    key: "conversation_cancelled",
    name: "Conversacion cancelada",
    body: "Conversacion cancelada. Si deseas comenzar de nuevo, responde MENU.",
    kind: TemplateKind.TEXT,
  },
  {
    key: "conversation_restarted",
    name: "Conversacion reiniciada",
    body: "Reiniciando la conversacion.",
    kind: TemplateKind.TEXT,
  },
];

const flowDefinitions: SeedFlow[] = [
  {
    key: "welcome",
    name: "Flujo de bienvenida",
    description: "Menu principal y enrute a otros pasos.",
    entryStepKey: "welcome_menu",
    fallbackTemplateKey: "welcome",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "hola", targetFlowKey: "welcome", priority: 1 },
      { matchType: BotRuleMatchType.EXACT, pattern: "hi", targetFlowKey: "welcome", priority: 2 },
      { matchType: BotRuleMatchType.EXACT, pattern: "hello", targetFlowKey: "welcome", priority: 3 },
      { matchType: BotRuleMatchType.EXACT, pattern: "menu", targetFlowKey: "welcome", priority: 4 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "informacion", targetFlowKey: "welcome", priority: 5 },
      { matchType: BotRuleMatchType.FALLBACK, pattern: "*", targetFlowKey: "welcome", priority: 999 },
    ],
    steps: [
      {
        key: "welcome_menu",
        name: "Menu principal",
        templateKey: "welcome",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "welcome_pricing",
        name: "Precios desde menu",
        templateKey: "pricing",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
      {
        key: "welcome_hours",
        name: "Horarios desde menu",
        templateKey: "hours",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
      {
        key: "welcome_location",
        name: "Ubicacion desde menu",
        templateKey: "location",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
      {
        key: "welcome_handoff",
        name: "Asesor desde menu",
        templateKey: "human_handoff",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.EXACT, pattern: "1", nextStepKey: "welcome_pricing", priority: 1 },
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.EXACT, pattern: "2", nextStepKey: "welcome_hours", priority: 2 },
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.EXACT, pattern: "3", nextStepKey: "welcome_location", priority: 3 },
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.EXACT, pattern: "4", nextStepKey: "welcome_handoff", priority: 4 },
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.EXACT, pattern: "5", nextFlowKey: "course_creation", nextStepKey: "course_name", priority: 5 },
      { stepKey: "welcome_menu", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "welcome_menu", priority: 999 },
    ],
  },
  {
    key: "pricing",
    name: "Flujo de precios",
    description: "Consulta directa de precios.",
    entryStepKey: "pricing_info",
    fallbackTemplateKey: "pricing",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "1", targetFlowKey: "pricing", priority: 1 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "precio", targetFlowKey: "pricing", priority: 2 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "precios", targetFlowKey: "pricing", priority: 3 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "cotizacion", targetFlowKey: "pricing", priority: 4 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "costos", targetFlowKey: "pricing", priority: 5 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "cuanto cuesta", targetFlowKey: "pricing", priority: 6 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "quiero precios", targetFlowKey: "pricing", priority: 7 },
    ],
    steps: [
      {
        key: "pricing_info",
        name: "Informacion de precios",
        templateKey: "pricing",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "hours",
    name: "Flujo de horarios",
    description: "Consulta directa de horarios.",
    entryStepKey: "hours_info",
    fallbackTemplateKey: "hours",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "2", targetFlowKey: "hours", priority: 1 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "horario", targetFlowKey: "hours", priority: 2 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "horarios", targetFlowKey: "hours", priority: 3 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "a que hora", targetFlowKey: "hours", priority: 4 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "que horario manejan", targetFlowKey: "hours", priority: 5 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "quiero horarios", targetFlowKey: "hours", priority: 6 },
    ],
    steps: [
      {
        key: "hours_info",
        name: "Informacion de horarios",
        templateKey: "hours",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "location",
    name: "Flujo de ubicacion",
    description: "Consulta directa de ubicacion.",
    entryStepKey: "location_info",
    fallbackTemplateKey: "location",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "3", targetFlowKey: "location", priority: 1 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "ubicacion", targetFlowKey: "location", priority: 2 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "direccion", targetFlowKey: "location", priority: 3 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "donde", targetFlowKey: "location", priority: 4 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "donde estan", targetFlowKey: "location", priority: 5 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "quiero ubicacion", targetFlowKey: "location", priority: 6 },
    ],
    steps: [
      {
        key: "location_info",
        name: "Informacion de ubicacion",
        templateKey: "location",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "human_handoff",
    name: "Flujo de asesor",
    description: "Escalacion a humano.",
    entryStepKey: "handoff_info",
    fallbackTemplateKey: "human_handoff",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "4", targetFlowKey: "human_handoff", priority: 1 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "asesor", targetFlowKey: "human_handoff", priority: 2 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "hablar con", targetFlowKey: "human_handoff", priority: 3 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "hablar con un asesor", targetFlowKey: "human_handoff", priority: 4 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "quiero hablar con alguien", targetFlowKey: "human_handoff", priority: 5 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "atencion humana", targetFlowKey: "human_handoff", priority: 6 },
      { matchType: BotRuleMatchType.KEYWORD, pattern: "humano", targetFlowKey: "human_handoff", priority: 7 },
    ],
    steps: [
      {
        key: "handoff_info",
        name: "Informacion de asesor",
        templateKey: "human_handoff",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "appointment_reminder",
    name: "Recordatorio de cita",
    description: "Recordatorio programatico de citas.",
    entryStepKey: "appointment_reminder_info",
    fallbackTemplateKey: "appointment_reminder",
    rules: [],
    steps: [
      {
        key: "appointment_reminder_info",
        name: "Envio recordatorio cita",
        templateKey: "appointment_reminder",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "payment_reminder",
    name: "Recordatorio de pago",
    description: "Recordatorio programatico de pagos.",
    entryStepKey: "payment_reminder_info",
    fallbackTemplateKey: "payment_reminder",
    rules: [],
    steps: [
      {
        key: "payment_reminder_info",
        name: "Envio recordatorio pago",
        templateKey: "payment_reminder",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [],
  },
  {
    key: "course_creation",
    name: "Creacion de curso",
    description: "Flujo multi paso para construir un curso.",
    entryStepKey: "course_name",
    fallbackTemplateKey: "course_creation_intro",
    rules: [
      { matchType: BotRuleMatchType.CONTAINS, pattern: "crear curso", targetFlowKey: "course_creation", priority: 1 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "crear un curso", targetFlowKey: "course_creation", priority: 2 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "quiero crear un curso", targetFlowKey: "course_creation", priority: 3 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "crear mi curso", targetFlowKey: "course_creation", priority: 4 },
    ],
    steps: [
      {
        key: "course_name",
        name: "Nombre del curso",
        templateKey: "course_creation_intro",
        inputType: FlowStepInputType.FREE_TEXT,
        captureKey: "courseName",
        isTerminal: false,
      },
      {
        key: "course_category",
        name: "Categoria del curso",
        templateKey: "course_creation_category",
        inputType: FlowStepInputType.CHOICE,
        captureKey: "courseCategory",
        isTerminal: false,
      },
      {
        key: "course_level",
        name: "Nivel del curso",
        templateKey: "course_creation_level",
        inputType: FlowStepInputType.CHOICE,
        captureKey: "courseLevel",
        isTerminal: false,
      },
      {
        key: "course_duration",
        name: "Duracion del curso",
        templateKey: "course_creation_duration",
        inputType: FlowStepInputType.FREE_TEXT,
        captureKey: "courseDuration",
        isTerminal: false,
      },
      {
        key: "course_price",
        name: "Precio del curso",
        templateKey: "course_creation_price",
        inputType: FlowStepInputType.FREE_TEXT,
        captureKey: "coursePrice",
        isTerminal: false,
      },
      {
        key: "course_confirm",
        name: "Confirmacion del curso",
        templateKey: "course_creation_confirm",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "course_completed",
        name: "Curso completado",
        templateKey: "course_creation_completed",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [
      { stepKey: "course_name", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_category", priority: 1 },
      { stepKey: "course_category", matchType: BotRuleMatchType.EXACT, pattern: "1", nextStepKey: "course_level", outputValue: "Programacion", priority: 1 },
      { stepKey: "course_category", matchType: BotRuleMatchType.EXACT, pattern: "2", nextStepKey: "course_level", outputValue: "Diseno", priority: 2 },
      { stepKey: "course_category", matchType: BotRuleMatchType.EXACT, pattern: "3", nextStepKey: "course_level", outputValue: "Marketing", priority: 3 },
      { stepKey: "course_category", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_category", priority: 999 },
      { stepKey: "course_level", matchType: BotRuleMatchType.EXACT, pattern: "1", nextStepKey: "course_duration", outputValue: "Basico", priority: 1 },
      { stepKey: "course_level", matchType: BotRuleMatchType.EXACT, pattern: "2", nextStepKey: "course_duration", outputValue: "Intermedio", priority: 2 },
      { stepKey: "course_level", matchType: BotRuleMatchType.EXACT, pattern: "3", nextStepKey: "course_duration", outputValue: "Avanzado", priority: 3 },
      { stepKey: "course_level", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_level", priority: 999 },
      { stepKey: "course_duration", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_price", priority: 1 },
      { stepKey: "course_price", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_confirm", priority: 1 },
      { stepKey: "course_confirm", matchType: BotRuleMatchType.EXACT, pattern: "1", nextStepKey: "course_completed", priority: 1 },
      { stepKey: "course_confirm", matchType: BotRuleMatchType.EXACT, pattern: "2", nextStepKey: "course_name", priority: 2 },
      { stepKey: "course_confirm", matchType: BotRuleMatchType.EXACT, pattern: "3", nextFlowKey: "human_handoff", nextStepKey: "handoff_info", priority: 3 },
      { stepKey: "course_confirm", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "course_confirm", priority: 999 },
    ],
  },
];

async function main() {
  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: template,
    });
  }

  const flowIdByKey = new Map<string, string>();

  for (const flow of flowDefinitions) {
    const flowData = {
      key: flow.key,
      name: flow.name,
      description: flow.description,
      entryStepKey: flow.entryStepKey,
      fallbackTemplateKey: flow.fallbackTemplateKey,
    };
    const botFlow = await prisma.botFlow.upsert({
      where: { key: flow.key },
      create: flowData,
      update: flowData,
    });

    flowIdByKey.set(flow.key, botFlow.id);
  }

  const allFlowIds = Array.from(flowIdByKey.values());
  const existingSteps = await prisma.botFlowStep.findMany({
    where: {
      flowId: {
        in: allFlowIds,
      },
    },
    select: { id: true },
  });
  const existingStepIds = existingSteps.map((step) => step.id);

  if (existingStepIds.length > 0) {
    await prisma.botFlowTransition.deleteMany({
      where: {
        OR: [
          {
            stepId: {
              in: existingStepIds,
            },
          },
          {
            nextStepId: {
              in: existingStepIds,
            },
          },
        ],
      },
    });
  }

  await prisma.botFlowStep.deleteMany({
    where: {
      flowId: {
        in: allFlowIds,
      },
    },
  });

  await prisma.botRule.deleteMany({
    where: {
      flowId: {
        in: allFlowIds,
      },
    },
  });

  for (const flow of flowDefinitions) {
    const flowId = flowIdByKey.get(flow.key);

    if (!flowId) {
      continue;
    }

    if (flow.steps.length > 0) {
      await prisma.botFlowStep.createMany({
        data: flow.steps.map((step) => ({
          flowId,
          key: step.key,
          name: step.name,
          templateKey: step.templateKey,
          inputType: step.inputType,
          captureKey: step.captureKey,
          isTerminal: step.isTerminal,
          isActive: true,
        })),
      });
    }

    if (flow.rules.length > 0) {
      await prisma.botRule.createMany({
        data: flow.rules.map((rule) => ({
          flowId,
          matchType: rule.matchType,
          pattern: rule.pattern,
          responseTemplateKey: rule.responseTemplateKey ?? null,
          targetFlowKey: rule.targetFlowKey ?? null,
          priority: rule.priority,
          isActive: true,
        })),
      });
    }
  }

  const allSteps = await prisma.botFlowStep.findMany({
    where: {
      flowId: {
        in: allFlowIds,
      },
    },
    select: {
      id: true,
      key: true,
      flowId: true,
      flow: {
        select: {
          key: true,
        },
      },
    },
  });
  const stepIdByFlowAndKey = new Map<string, string>();

  for (const step of allSteps) {
    stepIdByFlowAndKey.set(`${step.flow.key}:${step.key}`, step.id);
  }

  for (const flow of flowDefinitions) {
    const flowId = flowIdByKey.get(flow.key);

    if (!flowId || flow.transitions.length === 0) {
      continue;
    }

    await prisma.botFlowTransition.createMany({
      data: flow.transitions.map((transition) => {
        const sourceStepId = stepIdByFlowAndKey.get(`${flow.key}:${transition.stepKey}`);
        const nextFlowKey = transition.nextFlowKey ?? flow.key;
        const nextStepId = stepIdByFlowAndKey.get(`${nextFlowKey}:${transition.nextStepKey}`);

        if (!sourceStepId || !nextStepId) {
          throw new Error(
            `Missing step mapping for transition ${flow.key}:${transition.stepKey} -> ${nextFlowKey}:${transition.nextStepKey}`,
          );
        }

        return {
          stepId: sourceStepId,
          nextStepId,
          matchType: transition.matchType,
          pattern: transition.pattern,
          outputValue: transition.outputValue ?? null,
          priority: transition.priority,
          isActive: true,
        };
      }),
    });
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
