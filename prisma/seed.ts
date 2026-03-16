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
    key: "training_welcome_intro",
    name: "Capacitacion - Bienvenida",
    body: "Hola soy Nutrigi\nACYGP Entidad certificadora\n\n🎊🔓 ¡Que gusto tenerte aquí! Soy tu facilitadora virtual.\nEstas en el nivel inicial de tu capacitacion.\nDurante tu capacitacion recorreras 4 modulos:\nI. Verificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.\nII. Ejecucion de practicas higienicas antes de preparar alimentos en el expendio escolar.\nIII. Preparacion de alimentos y bebidas nutritivas de acuerdo con la normatividad para expendios escolares.\nIV. Proporcionar los alimentos a la comunidad escolar en el expendio.\n\n💡 Si durante el recorrido necesitas ayuda, escribe AYUDA aqui en WhatsApp.\n\n¡Tu decides en que momento avanzar!\nPuedes dedicarle 60 minutos al dia y te recomiendo tener una libreta para anotar lo que vas aprendiendo.\n\n¿Estas lista/o para emprender este nuevo recorrido?\nEscribe: SI VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_materials_intro",
    name: "Capacitacion - Materiales",
    body: "¡Excelente!\nDe ahora en adelante te presentare videos, audios, infografias, imagenes y algunas lecturas.\nPara ver los videos deberas presionar en los enlaces de color azul cada vez que te aparezcan.\nNo olvides que luego de ver cada video siempre debes regresar aqui a este chat de WhatsApp para seguir aprendiendo.\n\nSelecciona aqui para descargar tu manual de trabajo: [PENDIENTE_LINK_MANUAL]\n\n🤖📲 ¡Antes de olvidarme!\nSi abandonas el chat por mas de 24 horas, podrias perder tus avances y tendrias que regresar a tu capacitacion desde cero.\nTe enviaremos algunos recordatorios para ayudarte a continuar.\n\nCuando estes lista/o escribe: VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_module_1_intro",
    name: "Modulo 1 - Introduccion",
    body: "Recuerda seguir las instrucciones unicamente de este chat.\n⭐ Comenzamos con el modulo I:\nVerificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.\nEncontraras 12 temas y al finalizar podras desbloquear el modulo II.\n\n➡️ Mira el video seleccionando el link de color azul y aprenderas los conceptos basicos de higiene, nutricion, centro escolar y cooperativa/tienda/cafeteria escolar.\n[PENDIENTE_LINK_VIDEO_MODULO_1]\n\nSi estas lista/o avísame escribiendo: VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_cafeteria_experience",
    name: "Modulo 1 - Experiencia cafeteria",
    body: "¿Hace cuanto tiempo tienes tu cafeteria?\n1) Menos de 6 meses\n2) Entre 6 meses y 1 año\n3) Entre 1 y 2 años\n4) Mas de 2 años",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_eta_audio",
    name: "Modulo 1 - ETAs audio",
    body: "Selecciona aqui para descargar el video: [PENDIENTE_LINK_VIDEO_ETA]\nTe recomiendo tomar nota en tu libreta para que no te pierdas de nada.\n\n👀 Te comparto este audio sobre las Enfermedades Transmitidas por los Alimentos (ETA's):\n[PENDIENTE_LINK_AUDIO_ETA]\n\nCuando quieras avanzar escribe: VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_eta_activity",
    name: "Modulo 1 - Actividad ETAs",
    body: "Ahora descarga el formato y vas a crear las principales enfermedades transmitidas por alimentos.\nTómate tu tiempo y cuando termines escribe: CONTINUAR",
    mediaUrl: "/training-assets/modulo-1-eta-agentes.png",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_supply_chain",
    name: "Modulo 1 - Cadena de suministro",
    body: "➡️ Selecciona el link para ver este video y descubre la cadena de suministro de alimentos y los tipos principales de contaminacion alimentaria.\n[PENDIENTE_LINK_VIDEO_CADENA_SUMINISTRO]\n\nAl terminar, escribe: CONTINUEMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_regulation_intro",
    name: "Modulo 1 - Marco normativo",
    body: "✅ Aprenderas sobre el marco normativo en Mexico para la higiene y preparacion de alimentos, basado en la Ley General de Salud y la NOM-251-SSA1-2009.\nEsta norma establece practicas obligatorias de higiene para el proceso de alimentos, bebidas o suplementos, incluyendo instalaciones, equipos, personal y control de operaciones para garantizar la inocuidad.\n\n⭐ Descarga la norma:\nhttps://dof.gob.mx/nota_detalle.php%3Fcodigo%3D5133449%26fecha%3D01/03/2010&print=true\n\nTómate tu tiempo y cuando termines escribe: CONTINUAR",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_hygiene_summary",
    name: "Modulo 1 - Resumen higiene",
    body: "✅ Los equipos, utensilios y superficies en contacto con alimentos deben ser de materiales lisos, no porosos y de facil limpieza.\n✅ Deben lavarse y desinfectarse para evitar contaminacion.\n✅ Las instalaciones, incluyendo pisos, paredes y techos, deben mantenerse limpias y en buen estado.\n✅ Es obligatorio el lavado de manos del personal antes de iniciar labores, al regresar de ausencias y despues de manipular material sucio.\n✅ Los establecimientos deben contar con agua potable para la limpieza y desinfeccion.\n\nCuando quieras avanzar escribe: VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_cleaning_schedule",
    name: "Modulo 1 - Calendarizacion limpieza",
    body: "➡️ Selecciona el link para ver este video y descubre como es el procedimiento de limpieza y desinfectado especifico para instalaciones, equipos y transporte.\n[PENDIENTE_LINK_VIDEO_LIMPIEZA]\n\n✅ Ahora hagamos una calendarizacion y frecuencia por area o por equipo, con la persona responsable de llevarlo a cabo.\nDescarga el formato y trabajemos:\n[PENDIENTE_LINK_FORMATO_CALENDARIZACION]\n\nCuando estes lista/o escribe: VAMOS",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_drying_quiz",
    name: "Modulo 1 - Quiz secado",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el proceso de limpieza y secado.\n[PENDIENTE_LINK_VIDEO_SECADO]\n\n💡 ¿La norma menciona que el equipo y los utensilios no se sequen al aire libre para evitar la contaminacion por trapos o paños, los cuales pueden albergar bacterias?\nResponde: VERDADERO o FALSO",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_temperature_control",
    name: "Modulo 1 - Control temperatura",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el control de temperaturas de los alimentos.\n[PENDIENTE_LINK_VIDEO_TEMPERATURA]\n\n🚨 Si deseas avanzar, por favor escribe exactamente: CONTINUAR",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_services_infographic",
    name: "Modulo 1 - Servicios",
    body: "✅ ➡️ Selecciona el link y descarga la infografia de recomendaciones de los servicios de agua, aire y energia en tu establecimiento.\n[PENDIENTE_LINK_INFOGRAFIA_SERVICIOS]\n\nCuando estes lista/o escribe: CONTINUAR",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_evaluation_intro",
    name: "Modulo 1 - Evaluacion",
    body: "📚 ¡Ya llega la evaluacion!\nSi necesitas revisar el material, puedes tomar unos minutos para hacerlo.\n\nCuando quieras avanzar escribe: TEST\nTu respuesta esperada sera de tipo Correcto o Incorrecto.",
    kind: TemplateKind.TEXT,
  },
  {
    key: "training_module_2_intro",
    name: "Modulo 2 - Intro",
    body: "✨ ¡No pierdas la motivacion en este avance!\nSeguiremos aprendiendo con la misma dinamica: videos, imagenes, audios, infografias y algunas lecturas.\nNo olvides seguir tomando nota.\n\n🤩 ¡Vamos al modulo 2!",
    kind: TemplateKind.TEXT,
  },
  {
    key: "conversation_cancelled",
    name: "Conversacion cancelada",
    body: "Conversacion cancelada. Si deseas comenzar de nuevo, responde MENU.",
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

const flowDefinitions: SeedFlow[] = [
  {
    key: "welcome",
    name: "Capacitacion inicial",
    description: "Onboarding y modulo 1 de la capacitacion real.",
    entryStepKey: "training_welcome_intro",
    fallbackTemplateKey: "training_welcome_intro",
    rules: [
      { matchType: BotRuleMatchType.EXACT, pattern: "hola", targetFlowKey: "welcome", priority: 1 },
      { matchType: BotRuleMatchType.EXACT, pattern: "hi", targetFlowKey: "welcome", priority: 2 },
      { matchType: BotRuleMatchType.EXACT, pattern: "hello", targetFlowKey: "welcome", priority: 3 },
      { matchType: BotRuleMatchType.EXACT, pattern: "menu", targetFlowKey: "welcome", priority: 4 },
      { matchType: BotRuleMatchType.EXACT, pattern: "inicio", targetFlowKey: "welcome", priority: 5 },
      { matchType: BotRuleMatchType.EXACT, pattern: "ayuda", targetFlowKey: "welcome", priority: 6 },
      { matchType: BotRuleMatchType.CONTAINS, pattern: "si vamos", targetFlowKey: "welcome", priority: 7 },
      { matchType: BotRuleMatchType.FALLBACK, pattern: "*", targetFlowKey: "welcome", priority: 999 },
    ],
    steps: [
      {
        key: "training_welcome_intro",
        name: "Introduccion capacitacion",
        templateKey: "training_welcome_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_materials_intro",
        name: "Materiales e instrucciones",
        templateKey: "training_materials_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_module_1_intro",
        name: "Introduccion modulo 1",
        templateKey: "training_module_1_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_cafeteria_experience",
        name: "Experiencia cafeteria",
        templateKey: "training_cafeteria_experience",
        inputType: FlowStepInputType.CHOICE,
        captureKey: "cafeteriaExperience",
        isTerminal: false,
      },
      {
        key: "training_eta_audio",
        name: "Audio ETAs",
        templateKey: "training_eta_audio",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_eta_activity",
        name: "Actividad ETAs",
        templateKey: "training_eta_activity",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_supply_chain",
        name: "Cadena de suministro",
        templateKey: "training_supply_chain",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_regulation_intro",
        name: "Marco normativo",
        templateKey: "training_regulation_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_hygiene_summary",
        name: "Resumen higiene",
        templateKey: "training_hygiene_summary",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_cleaning_schedule",
        name: "Calendarizacion limpieza",
        templateKey: "training_cleaning_schedule",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_drying_quiz",
        name: "Quiz secado",
        templateKey: "training_drying_quiz",
        inputType: FlowStepInputType.CHOICE,
        captureKey: "dryingQuizAnswer",
        isTerminal: false,
      },
      {
        key: "training_temperature_control",
        name: "Control temperatura",
        templateKey: "training_temperature_control",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_services_infographic",
        name: "Infografia servicios",
        templateKey: "training_services_infographic",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_evaluation_intro",
        name: "Evaluacion modulo 1",
        templateKey: "training_evaluation_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: false,
      },
      {
        key: "training_module_2_intro",
        name: "Inicio modulo 2",
        templateKey: "training_module_2_intro",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [
      { stepKey: "training_welcome_intro", matchType: BotRuleMatchType.EXACT, pattern: "si vamos", nextStepKey: "training_materials_intro", priority: 1 },
      { stepKey: "training_welcome_intro", matchType: BotRuleMatchType.EXACT, pattern: "si", nextStepKey: "training_materials_intro", priority: 2 },
      { stepKey: "training_welcome_intro", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_materials_intro", priority: 3 },
      { stepKey: "training_welcome_intro", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_welcome_intro", priority: 999 },
      { stepKey: "training_materials_intro", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_module_1_intro", priority: 1 },
      { stepKey: "training_materials_intro", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_materials_intro", priority: 999 },
      { stepKey: "training_module_1_intro", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_cafeteria_experience", priority: 1 },
      { stepKey: "training_module_1_intro", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_module_1_intro", priority: 999 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.EXACT, pattern: "1", nextStepKey: "training_eta_audio", outputValue: "Menos de 6 meses", priority: 1 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.CONTAINS, pattern: "menos de 6 meses", nextStepKey: "training_eta_audio", outputValue: "Menos de 6 meses", priority: 2 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.EXACT, pattern: "2", nextStepKey: "training_eta_audio", outputValue: "Entre 6 meses y 1 año", priority: 3 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.CONTAINS, pattern: "entre 6 meses y 1 ano", nextStepKey: "training_eta_audio", outputValue: "Entre 6 meses y 1 año", priority: 4 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.EXACT, pattern: "3", nextStepKey: "training_eta_audio", outputValue: "Entre 1 y 2 años", priority: 5 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.CONTAINS, pattern: "entre 1 y 2 anos", nextStepKey: "training_eta_audio", outputValue: "Entre 1 y 2 años", priority: 6 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.EXACT, pattern: "4", nextStepKey: "training_eta_audio", outputValue: "Mas de 2 años", priority: 7 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.CONTAINS, pattern: "mas de 2 anos", nextStepKey: "training_eta_audio", outputValue: "Mas de 2 años", priority: 8 },
      { stepKey: "training_cafeteria_experience", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_cafeteria_experience", priority: 999 },
      { stepKey: "training_eta_audio", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_eta_activity", priority: 1 },
      { stepKey: "training_eta_audio", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_eta_audio", priority: 999 },
      { stepKey: "training_eta_activity", matchType: BotRuleMatchType.EXACT, pattern: "continuar", nextStepKey: "training_supply_chain", priority: 1 },
      { stepKey: "training_eta_activity", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_eta_activity", priority: 999 },
      { stepKey: "training_supply_chain", matchType: BotRuleMatchType.EXACT, pattern: "continuemos", nextStepKey: "training_regulation_intro", priority: 1 },
      { stepKey: "training_supply_chain", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_supply_chain", priority: 999 },
      { stepKey: "training_regulation_intro", matchType: BotRuleMatchType.EXACT, pattern: "continuar", nextStepKey: "training_hygiene_summary", priority: 1 },
      { stepKey: "training_regulation_intro", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_regulation_intro", priority: 999 },
      { stepKey: "training_hygiene_summary", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_cleaning_schedule", priority: 1 },
      { stepKey: "training_hygiene_summary", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_hygiene_summary", priority: 999 },
      { stepKey: "training_cleaning_schedule", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_drying_quiz", priority: 1 },
      { stepKey: "training_cleaning_schedule", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_cleaning_schedule", priority: 999 },
      { stepKey: "training_drying_quiz", matchType: BotRuleMatchType.EXACT, pattern: "verdadero", nextStepKey: "training_temperature_control", outputValue: "Verdadero", priority: 1 },
      { stepKey: "training_drying_quiz", matchType: BotRuleMatchType.EXACT, pattern: "falso", nextStepKey: "training_temperature_control", outputValue: "Falso", priority: 2 },
      { stepKey: "training_drying_quiz", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_drying_quiz", priority: 999 },
      { stepKey: "training_temperature_control", matchType: BotRuleMatchType.EXACT, pattern: "continuar", nextStepKey: "training_services_infographic", priority: 1 },
      { stepKey: "training_temperature_control", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_temperature_control", priority: 999 },
      { stepKey: "training_services_infographic", matchType: BotRuleMatchType.EXACT, pattern: "continuar", nextStepKey: "training_evaluation_intro", priority: 1 },
      { stepKey: "training_services_infographic", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_services_infographic", priority: 999 },
      { stepKey: "training_evaluation_intro", matchType: BotRuleMatchType.EXACT, pattern: "test", nextStepKey: "training_module_2_intro", priority: 1 },
      { stepKey: "training_evaluation_intro", matchType: BotRuleMatchType.EXACT, pattern: "vamos", nextStepKey: "training_module_2_intro", priority: 2 },
      { stepKey: "training_evaluation_intro", matchType: BotRuleMatchType.FALLBACK, pattern: "*", nextStepKey: "training_evaluation_intro", priority: 999 },
    ],
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
    if (flow.transitions.length === 0) {
      continue;
    }

    await prisma.botFlowTransition.createMany({
      data: flow.transitions.map((transition) => {
        const sourceStepId = stepIdByFlowAndKey.get(`${flow.key}:${transition.stepKey}`);
        const nextStepId = stepIdByFlowAndKey.get(`${flow.key}:${transition.nextStepKey}`);

        if (!sourceStepId || !nextStepId) {
          throw new Error(
            `Missing step mapping for transition ${flow.key}:${transition.stepKey} -> ${flow.key}:${transition.nextStepKey}`,
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
