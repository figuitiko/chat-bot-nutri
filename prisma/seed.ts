import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import {
  CourseStatus,
  CourseStepType,
  BotRuleMatchType,
  FlowStepRenderMode,
  FlowStepInputType,
  PrismaClient,
  TemplateDeliveryMode,
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
  renderMode?: FlowStepRenderMode;
  assessmentKey?: string;
  correctAnswer?: string;
  scoreWeight?: number;
  isAssessmentResult?: boolean;
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

type SeedCourseModule = {
  slug: string;
  title: string;
  summary: string;
  stepKeys: string[];
};

const templates = [
  {
    key: "training_welcome_intro",
    name: "Capacitacion - Bienvenida",
    body: "Durante tu capacitacion recorreras 4 modulos:\n*I. Verificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.*\n*II. Ejecucion de practicas higienicas antes de preparar alimentos en el expendio escolar.*\n*III. Preparacion de alimentos y bebidas nutritivas de acuerdo con la normatividad para expendios escolares.*\n*IV. Proporcionar los alimentos a la comunidad escolar en el expendio.*\n\n💡 Si durante el recorrido necesitas ayuda, escribe AYUDA aqui en WhatsApp.\n\n¡Tu decides en que momento avanzar!\nPuedes dedicarle 60 minutos al dia y te recomiendo tener una libreta para anotar lo que vas aprendiendo.\n\n¿Estas lista/o para emprender este nuevo recorrido?\nDa click en: VAMOS o escribe Vamos",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.MEDIA_FIRST,
    mediaUrl: "/training-assets/nutri.jpeg",
    twilioContentSid: null,
  },
  {
    key: "training_materials_intro",
    name: "Capacitacion - Materiales",
    body: "¡Excelente!\nDe ahora en adelante te presentare videos, audios, infografias, imagenes y algunas lecturas.\nPara ver los videos deberas presionar en los enlaces de color azul cada vez que te aparezcan.\nNo olvides que luego de ver cada video siempre debes regresar aqui a este chat de WhatsApp para seguir aprendiendo.\n\nSelecciona aqui para descargar tu manual de trabajo: [PENDIENTE_LINK_MANUAL]\n\n🤖📲 ¡Antes de olvidarme!\nSi abandonas el chat por mas de 24 horas, podrias perder tus avances y tendrias que regresar a tu capacitacion desde cero.\nTe enviaremos algunos recordatorios para ayudarte a continuar.\n\nCuando estes lista/o da click en VAMOS o escribe: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_1_intro",
    name: "Modulo 1 - Introduccion",
    body: "Recuerda seguir las instrucciones unicamente de este chat.\n⭐ Comenzamos con el modulo I:\nVerificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.\nEncontraras 12 temas y al finalizar podras desbloquear el modulo II.\n\n➡️ Mira el video seleccionando el link de color azul y aprenderas los conceptos basicos de higiene, nutricion, centro escolar y cooperativa/tienda/cafeteria escolar.\n[PENDIENTE_LINK_VIDEO_MODULO_1]\n\nSi estas lista/o avísame dando Click en VAMOS o escribiendo: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_cafeteria_experience",
    name: "Modulo 1 - Experiencia cafeteria",
    body: "¿Hace cuanto tiempo tienes tu cafeteria?\n1) Menos de 6 meses\n2) Entre 6 meses y 1 año\n3) Entre 1 y 2 años\n4) Mas de 2 años",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_eta_audio",
    name: "Modulo 1 - ETAs audio",
    body: "Selecciona aqui para descargar el video: [PENDIENTE_LINK_VIDEO_ETA]\nTe recomiendo tomar nota en tu libreta para que no te pierdas de nada.\n\n👀 Te comparto el audio adjunto sobre las Enfermedades Transmitidas por los Alimentos (ETA's).\n\nCuando quieras avanzar da click en VAMOS o escribe: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.MEDIA_FIRST,
    mediaUrl: "/training-assets/audio-nutri.mp3",
    twilioContentSid: null,
  },
  {
    key: "training_eta_activity",
    name: "Modulo 1 - Actividad ETAs",
    body: "Te comparto la imagen adjunta para esta actividad.\nAhora descarga el formato y vas a crear las principales enfermedades transmitidas por alimentos.\nTómate tu tiempo y cuando termines da click en CONTINUAR o escribe: CONTINUAR",
    mediaUrl: "/training-assets/modulo-1-eta-agentes.png",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
  },
  {
    key: "training_supply_chain",
    name: "Modulo 1 - Cadena de suministro",
    body: "➡️ Selecciona el link para ver este video y descubre la cadena de suministro de alimentos y los tipos principales de contaminacion alimentaria.\n[PENDIENTE_LINK_VIDEO_CADENA_SUMINISTRO]\n\nAl terminar, da click en CONTINUEMOS o escribe: CONTINUEMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_regulation_intro",
    name: "Modulo 1 - Marco normativo",
    body: "✅ Aprenderas sobre el marco normativo en Mexico para la higiene y preparacion de alimentos, basado en la Ley General de Salud y la NOM-251-SSA1-2009.\nEsta norma establece practicas obligatorias de higiene para el proceso de alimentos, bebidas o suplementos, incluyendo instalaciones, equipos, personal y control de operaciones para garantizar la inocuidad.\n\n⭐ Descarga la norma:\nhttps://dof.gob.mx/nota_detalle.php%3Fcodigo%3D5133449%26fecha%3D01/03/2010&print=true\n\nTómate tu tiempo y cuando termines da click en CONTINUAR o escribe: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_hygiene_summary",
    name: "Modulo 1 - Resumen higiene",
    body: "✅ Los equipos, utensilios y superficies en contacto con alimentos deben ser de materiales lisos, no porosos y de facil limpieza.\n✅ Deben lavarse y desinfectarse para evitar contaminacion.\n✅ Las instalaciones, incluyendo pisos, paredes y techos, deben mantenerse limpias y en buen estado.\n✅ Es obligatorio el lavado de manos del personal antes de iniciar labores, al regresar de ausencias y despues de manipular material sucio.\n✅ Los establecimientos deben contar con agua potable para la limpieza y desinfeccion.\n\nCuando quieras avanzar da click en VAMOS o escribe: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_cleaning_schedule",
    name: "Modulo 1 - Calendarizacion limpieza",
    body: "➡️ Selecciona el link para ver este video y descubre como es el procedimiento de limpieza y desinfectado especifico para instalaciones, equipos y transporte.\n[PENDIENTE_LINK_VIDEO_LIMPIEZA]\n\n✅ Ahora hagamos una calendarizacion y frecuencia por area o por equipo, con la persona responsable de llevarlo a cabo.\nDescarga el formato y trabajemos:\n https://chat-bot-nutri.vercel.app/training-assets/plan_de_trabajo.docx \n\nCuando estes lista/o da click en VAMOS o escribe: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz",
    name: "Modulo 1 - Quiz secado",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el proceso de limpieza y secado.\n[PENDIENTE_LINK_VIDEO_SECADO]\n\n💡 ¿La norma menciona que el equipo y los utensilios no se sequen al aire libre para evitar la contaminacion por trapos o paños, los cuales pueden albergar bacterias?\nResponde: VERDADERO o FALSO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz_correct",
    name: "Modulo 1 - Quiz secado correcto",
    body: "✅ ¡Correcto! La respuesta es FALSO.\nLa norma indica que el equipo y los utensilios no deben secarse al aire libre si eso expone el material a contaminacion. Lo importante es evitar practicas o elementos que puedan contaminar, como trapos o paños en mal estado.\n\nCuando quieras avanzar  da click en CONTINUAR o escribe: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz_incorrect",
    name: "Modulo 1 - Quiz secado incorrecto",
    body: "❌ Casi. La respuesta correcta es FALSO.\nLa idea es evitar que el secado genere contaminacion. Por eso no deben usarse practicas o materiales que puedan transferir bacterias a los utensilios.\n\nCuando quieras avanzar da click en CONTINUAR o escribe: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_temperature_control",
    name: "Modulo 1 - Control temperatura",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el control de temperaturas de los alimentos.\n[PENDIENTE_LINK_VIDEO_TEMPERATURA]\n\n🚨 Si deseas avanzar, da click en CONTINUAR o escribe: CONTINUA",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_services_infographic",
    name: "Modulo 1 - Servicios",
    body: "✅ ➡️ Selecciona el link y descarga la infografia de recomendaciones de los servicios de agua, aire y energia en tu establecimiento.\n[PENDIENTE_LINK_INFOGRAFIA_SERVICIOS]\n\nCuando estes lista/o da click en CONTINUAR o escribe: CONTINUA",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_intro",
    name: "Modulo 1 - Evaluacion",
    body: "📚 ¡Ya llega la evaluacion!\nSi necesitas revisar el material, puedes tomar unos minutos para hacerlo.\n\nCuando quieras comenzar responde: TEST.\nLa evaluacion tiene 4 preguntas y cada una vale 25%.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q1",
    name: "Modulo 1 - Evaluacion pregunta 1",
    body: "1.- Ocurren por la ingestion de comida contaminada, que afecta la salud del consumidor:\nA) Infecciones alimentarias\nB) Enfermedades transmitidas por alimentos\nC) Intoxicaciones alimentarias",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q2",
    name: "Modulo 1 - Evaluacion pregunta 2",
    body: "2.- Son microorganismos que se multiplican en alimentos que, por su composicion, crean un ambiente ideal para su crecimiento y desarrollo.\nA) Carnes crudas y lacteos\nB) Mariscos y huevo\nC) A y B",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q3",
    name: "Modulo 1 - Evaluacion pregunta 3",
    body: "3.- Estas enfermedades son causadas por la ingestion de alimentos contaminados por microorganismos que producen enfermedades como salmonelosis, listeriosis, triquinosis, hepatitis A y toxoplasmosis.\nA) Infecciones alimentarias\nB) Enfermedades transmitidas por alimentos\nC) Intoxicaciones alimentarias",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q4",
    name: "Modulo 1 - Evaluacion pregunta 4",
    body: "4.- Se generan por la ingesta de alimentos que tienen adheridos toxinas, sustancias quimicas externas o veneno. Algunos ejemplos son botulismo, intoxicacion por estafilococo o por toxinas producidas por hongos o especies marinas.\nA) Infecciones alimentarias\nB) Enfermedades transmitidas por alimentos\nC) Intoxicaciones alimentarias",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_result",
    name: "Modulo 1 - Evaluacion resultado",
    body: "📝 Resultado de tu evaluacion:\nRespuestas correctas: {{evaluationCorrectAnswers}} de {{evaluationTotalQuestions}}\nPorcentaje final: {{evaluationPercentage}}%\n\nGracias por completar el modulo 1. Cuando quieras avanzar al siguiente modulo, responde: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
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
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "hola",
        targetFlowKey: "welcome",
        priority: 1,
      },
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "hi",
        targetFlowKey: "welcome",
        priority: 2,
      },
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "hello",
        targetFlowKey: "welcome",
        priority: 3,
      },
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "menu",
        targetFlowKey: "welcome",
        priority: 4,
      },
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "inicio",
        targetFlowKey: "welcome",
        priority: 5,
      },
      {
        matchType: BotRuleMatchType.EXACT,
        pattern: "ayuda",
        targetFlowKey: "welcome",
        priority: 6,
      },
      {
        matchType: BotRuleMatchType.CONTAINS,
        pattern: "si vamos",
        targetFlowKey: "welcome",
        priority: 7,
      },
      {
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        targetFlowKey: "welcome",
        priority: 999,
      },
    ],
    steps: [
      {
        key: "training_welcome_intro",
        name: "Introduccion capacitacion",
        templateKey: "training_welcome_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_materials_intro",
        name: "Materiales e instrucciones",
        templateKey: "training_materials_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_1_intro",
        name: "Introduccion modulo 1",
        templateKey: "training_module_1_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_cafeteria_experience",
        name: "Experiencia cafeteria",
        templateKey: "training_cafeteria_experience",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        captureKey: "cafeteriaExperience",
        isTerminal: false,
      },
      {
        key: "training_eta_audio",
        name: "Audio ETAs",
        templateKey: "training_eta_audio",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_eta_activity",
        name: "Actividad ETAs",
        templateKey: "training_eta_activity",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_supply_chain",
        name: "Cadena de suministro",
        templateKey: "training_supply_chain",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_regulation_intro",
        name: "Marco normativo",
        templateKey: "training_regulation_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_hygiene_summary",
        name: "Resumen higiene",
        templateKey: "training_hygiene_summary",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_cleaning_schedule",
        name: "Calendarizacion limpieza",
        templateKey: "training_cleaning_schedule",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_drying_quiz",
        name: "Quiz secado",
        templateKey: "training_drying_quiz",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        captureKey: "dryingQuizAnswer",
        isTerminal: false,
      },
      {
        key: "training_drying_quiz_correct",
        name: "Quiz secado correcto",
        templateKey: "training_drying_quiz_correct",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_drying_quiz_incorrect",
        name: "Quiz secado incorrecto",
        templateKey: "training_drying_quiz_incorrect",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_temperature_control",
        name: "Control temperatura",
        templateKey: "training_temperature_control",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_services_infographic",
        name: "Infografia servicios",
        templateKey: "training_services_infographic",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_evaluation_intro",
        name: "Evaluacion modulo 1",
        templateKey: "training_evaluation_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_evaluation_q1",
        name: "Evaluacion pregunta 1",
        templateKey: "training_evaluation_q1",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "module_1_final_test",
        correctAnswer: "B",
        scoreWeight: 25,
        captureKey: "evaluationQ1",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q2",
        name: "Evaluacion pregunta 2",
        templateKey: "training_evaluation_q2",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "module_1_final_test",
        correctAnswer: "C",
        scoreWeight: 25,
        captureKey: "evaluationQ2",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q3",
        name: "Evaluacion pregunta 3",
        templateKey: "training_evaluation_q3",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "module_1_final_test",
        correctAnswer: "A",
        scoreWeight: 25,
        captureKey: "evaluationQ3",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q4",
        name: "Evaluacion pregunta 4",
        templateKey: "training_evaluation_q4",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "module_1_final_test",
        correctAnswer: "C",
        scoreWeight: 25,
        captureKey: "evaluationQ4",
        isTerminal: false,
      },
      {
        key: "training_evaluation_result",
        name: "Evaluacion resultado",
        templateKey: "training_evaluation_result",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "module_1_final_test",
        isAssessmentResult: true,
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
      {
        stepKey: "training_welcome_intro",
        matchType: BotRuleMatchType.EXACT,
        pattern: "si vamos",
        nextStepKey: "training_materials_intro",
        priority: 1,
      },
      {
        stepKey: "training_welcome_intro",
        matchType: BotRuleMatchType.KEYWORD,
        pattern: "si",
        nextStepKey: "training_materials_intro",
        priority: 2,
      },
      {
        stepKey: "training_welcome_intro",
        matchType: BotRuleMatchType.KEYWORD,
        pattern: "vamos",
        nextStepKey: "training_materials_intro",
        priority: 3,
      },
      {
        stepKey: "training_welcome_intro",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_welcome_intro",
        priority: 999,
      },
      {
        stepKey: "training_materials_intro",
        matchType: BotRuleMatchType.EXACT,
        pattern: "vamos",
        nextStepKey: "training_module_1_intro",
        priority: 1,
      },
      {
        stepKey: "training_materials_intro",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_materials_intro",
        priority: 999,
      },
      {
        stepKey: "training_module_1_intro",
        matchType: BotRuleMatchType.EXACT,
        pattern: "vamos",
        nextStepKey: "training_cafeteria_experience",
        priority: 1,
      },
      {
        stepKey: "training_module_1_intro",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_module_1_intro",
        priority: 999,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.EXACT,
        pattern: "1",
        nextStepKey: "training_eta_audio",
        outputValue: "Menos de 6 meses",
        priority: 1,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.CONTAINS,
        pattern: "menos de 6 meses",
        nextStepKey: "training_eta_audio",
        outputValue: "Menos de 6 meses",
        priority: 2,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.EXACT,
        pattern: "2",
        nextStepKey: "training_eta_audio",
        outputValue: "Entre 6 meses y 1 año",
        priority: 3,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.CONTAINS,
        pattern: "entre 6 meses y 1 ano",
        nextStepKey: "training_eta_audio",
        outputValue: "Entre 6 meses y 1 año",
        priority: 4,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.EXACT,
        pattern: "3",
        nextStepKey: "training_eta_audio",
        outputValue: "Entre 1 y 2 años",
        priority: 5,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.CONTAINS,
        pattern: "entre 1 y 2 anos",
        nextStepKey: "training_eta_audio",
        outputValue: "Entre 1 y 2 años",
        priority: 6,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.EXACT,
        pattern: "4",
        nextStepKey: "training_eta_audio",
        outputValue: "Mas de 2 años",
        priority: 7,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.CONTAINS,
        pattern: "mas de 2 anos",
        nextStepKey: "training_eta_audio",
        outputValue: "Mas de 2 años",
        priority: 8,
      },
      {
        stepKey: "training_cafeteria_experience",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_cafeteria_experience",
        priority: 999,
      },
      {
        stepKey: "training_eta_audio",
        matchType: BotRuleMatchType.EXACT,
        pattern: "vamos",
        nextStepKey: "training_eta_activity",
        priority: 1,
      },
      {
        stepKey: "training_eta_audio",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_eta_audio",
        priority: 999,
      },
      {
        stepKey: "training_eta_activity",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_supply_chain",
        priority: 1,
      },
      {
        stepKey: "training_eta_activity",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_eta_activity",
        priority: 999,
      },
      {
        stepKey: "training_supply_chain",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuemos",
        nextStepKey: "training_regulation_intro",
        priority: 1,
      },
      {
        stepKey: "training_supply_chain",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_supply_chain",
        priority: 999,
      },
      {
        stepKey: "training_regulation_intro",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_hygiene_summary",
        priority: 1,
      },
      {
        stepKey: "training_regulation_intro",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_regulation_intro",
        priority: 999,
      },
      {
        stepKey: "training_hygiene_summary",
        matchType: BotRuleMatchType.EXACT,
        pattern: "vamos",
        nextStepKey: "training_cleaning_schedule",
        priority: 1,
      },
      {
        stepKey: "training_hygiene_summary",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_hygiene_summary",
        priority: 999,
      },
      {
        stepKey: "training_cleaning_schedule",
        matchType: BotRuleMatchType.EXACT,
        pattern: "vamos",
        nextStepKey: "training_drying_quiz",
        priority: 1,
      },
      {
        stepKey: "training_cleaning_schedule",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_cleaning_schedule",
        priority: 999,
      },
      {
        stepKey: "training_drying_quiz",
        matchType: BotRuleMatchType.EXACT,
        pattern: "verdadero",
        nextStepKey: "training_drying_quiz_incorrect",
        outputValue: "Verdadero",
        priority: 1,
      },
      {
        stepKey: "training_drying_quiz",
        matchType: BotRuleMatchType.EXACT,
        pattern: "falso",
        nextStepKey: "training_drying_quiz_correct",
        outputValue: "Falso",
        priority: 2,
      },
      {
        stepKey: "training_drying_quiz",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_drying_quiz",
        priority: 999,
      },
      {
        stepKey: "training_drying_quiz_correct",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_temperature_control",
        priority: 1,
      },
      {
        stepKey: "training_drying_quiz_correct",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_drying_quiz_correct",
        priority: 999,
      },
      {
        stepKey: "training_drying_quiz_incorrect",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_temperature_control",
        priority: 1,
      },
      {
        stepKey: "training_drying_quiz_incorrect",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_drying_quiz_incorrect",
        priority: 999,
      },
      {
        stepKey: "training_temperature_control",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_services_infographic",
        priority: 1,
      },
      {
        stepKey: "training_temperature_control",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_temperature_control",
        priority: 999,
      },
      {
        stepKey: "training_services_infographic",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_evaluation_intro",
        priority: 1,
      },
      {
        stepKey: "training_services_infographic",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_services_infographic",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_intro",
        matchType: BotRuleMatchType.EXACT,
        pattern: "test",
        nextStepKey: "training_evaluation_q1",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_intro",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_intro",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_q1",
        matchType: BotRuleMatchType.EXACT,
        pattern: "a",
        nextStepKey: "training_evaluation_q2",
        outputValue: "A",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_q1",
        matchType: BotRuleMatchType.EXACT,
        pattern: "b",
        nextStepKey: "training_evaluation_q2",
        outputValue: "B",
        priority: 2,
      },
      {
        stepKey: "training_evaluation_q1",
        matchType: BotRuleMatchType.EXACT,
        pattern: "c",
        nextStepKey: "training_evaluation_q2",
        outputValue: "C",
        priority: 3,
      },
      {
        stepKey: "training_evaluation_q1",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_q1",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_q2",
        matchType: BotRuleMatchType.EXACT,
        pattern: "a",
        nextStepKey: "training_evaluation_q3",
        outputValue: "A",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_q2",
        matchType: BotRuleMatchType.EXACT,
        pattern: "b",
        nextStepKey: "training_evaluation_q3",
        outputValue: "B",
        priority: 2,
      },
      {
        stepKey: "training_evaluation_q2",
        matchType: BotRuleMatchType.EXACT,
        pattern: "c",
        nextStepKey: "training_evaluation_q3",
        outputValue: "C",
        priority: 3,
      },
      {
        stepKey: "training_evaluation_q2",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_q2",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_q3",
        matchType: BotRuleMatchType.EXACT,
        pattern: "a",
        nextStepKey: "training_evaluation_q4",
        outputValue: "A",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_q3",
        matchType: BotRuleMatchType.EXACT,
        pattern: "b",
        nextStepKey: "training_evaluation_q4",
        outputValue: "B",
        priority: 2,
      },
      {
        stepKey: "training_evaluation_q3",
        matchType: BotRuleMatchType.EXACT,
        pattern: "c",
        nextStepKey: "training_evaluation_q4",
        outputValue: "C",
        priority: 3,
      },
      {
        stepKey: "training_evaluation_q3",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_q3",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_q4",
        matchType: BotRuleMatchType.EXACT,
        pattern: "a",
        nextStepKey: "training_evaluation_result",
        outputValue: "A",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_q4",
        matchType: BotRuleMatchType.EXACT,
        pattern: "b",
        nextStepKey: "training_evaluation_result",
        outputValue: "B",
        priority: 2,
      },
      {
        stepKey: "training_evaluation_q4",
        matchType: BotRuleMatchType.EXACT,
        pattern: "c",
        nextStepKey: "training_evaluation_result",
        outputValue: "C",
        priority: 3,
      },
      {
        stepKey: "training_evaluation_q4",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_q4",
        priority: 999,
      },
      {
        stepKey: "training_evaluation_result",
        matchType: BotRuleMatchType.EXACT,
        pattern: "continuar",
        nextStepKey: "training_module_2_intro",
        priority: 1,
      },
      {
        stepKey: "training_evaluation_result",
        matchType: BotRuleMatchType.FALLBACK,
        pattern: "*",
        nextStepKey: "training_evaluation_result",
        priority: 999,
      },
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

const nutriCourseModules: SeedCourseModule[] = [
  {
    slug: "bienvenida",
    title: "Bienvenida y materiales",
    summary: "Onboarding inicial y materiales de trabajo para arrancar la capacitacion.",
    stepKeys: ["training_welcome_intro", "training_materials_intro"],
  },
  {
    slug: "modulo-1",
    title: "Modulo 1 - Verificacion de condiciones",
    summary:
      "Contenido guiado, actividades, preguntas y evaluacion del modulo 1 de nutricion.",
    stepKeys: [
      "training_module_1_intro",
      "training_cafeteria_experience",
      "training_eta_audio",
      "training_eta_activity",
      "training_supply_chain",
      "training_regulation_intro",
      "training_hygiene_summary",
      "training_cleaning_schedule",
      "training_drying_quiz",
      "training_drying_quiz_correct",
      "training_drying_quiz_incorrect",
      "training_temperature_control",
      "training_services_infographic",
      "training_evaluation_intro",
      "training_evaluation_q1",
      "training_evaluation_q2",
      "training_evaluation_q3",
      "training_evaluation_q4",
      "training_evaluation_result",
    ],
  },
  {
    slug: "modulo-2",
    title: "Modulo 2 - Ejecucion de practicas higienicas",
    summary: "Punto de salida actual para el modulo 2 del curso Nutri.",
    stepKeys: ["training_module_2_intro"],
  },
];

function getTransitionDisplayLabel(pattern: string, outputValue?: string) {
  if (outputValue?.trim()) {
    return /^\d+$/.test(pattern.trim()) ? pattern.trim() : outputValue.trim();
  }

  return pattern.trim().replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function getTransitionDisplayHint(pattern: string, outputValue?: string) {
  if (!outputValue?.trim()) {
    return undefined;
  }

  return /^\d+$/.test(pattern.trim()) ? outputValue.trim() : undefined;
}

async function main() {
  const templateByKey = new Map(templates.map((template) => [template.key, template]));
  const welcomeFlow = flowDefinitions.find((flow) => flow.key === "welcome");

  if (!welcomeFlow) {
    throw new Error("The welcome flow definition is required to seed the Nutri course.");
  }

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
          renderMode: step.renderMode ?? FlowStepRenderMode.TEXT,
          assessmentKey: step.assessmentKey,
          correctAnswer: step.correctAnswer,
          scoreWeight: step.scoreWeight ?? null,
          isAssessmentResult: step.isAssessmentResult ?? false,
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
        const sourceStepId = stepIdByFlowAndKey.get(
          `${flow.key}:${transition.stepKey}`,
        );
        const nextStepId = stepIdByFlowAndKey.get(
          `${flow.key}:${transition.nextStepKey}`,
        );

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

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      create: {
        email: adminEmail,
        name: process.env.ADMIN_NAME ?? "Admin",
        passwordHash: await hash(adminPassword, 10),
      },
      update: {
        name: process.env.ADMIN_NAME ?? "Admin",
        passwordHash: await hash(adminPassword, 10),
        isActive: true,
      },
    });
  }

  const seededAssets = [
    {
      url: "public://training-assets/nutri.jpeg",
      pathname: "/training-assets/nutri.jpeg",
      kind: "IMAGE" as const,
      contentType: "image/jpeg",
    },
    {
      url: "public://training-assets/audio-nutri.mp3",
      pathname: "/training-assets/audio-nutri.mp3",
      kind: "AUDIO" as const,
      contentType: "audio/mpeg",
    },
    {
      url: "public://training-assets/modulo-1-eta-agentes.png",
      pathname: "/training-assets/modulo-1-eta-agentes.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
  ];

  for (const asset of seededAssets) {
    await prisma.asset.upsert({
      where: { url: asset.url },
      create: asset,
      update: asset,
    });
  }

  const coverAsset = await prisma.asset.findUnique({
    where: { url: "public://training-assets/nutri.jpeg" },
    select: { id: true },
  });

  const course = await prisma.course.upsert({
    where: { slug: "nutri" },
    create: {
      slug: "nutri",
      name: "Nutri",
      description:
        "Capacitacion administrable para el bot de WhatsApp enfocada en nutricion y expendios escolares.",
      status: CourseStatus.ACTIVE,
      isActive: true,
      activatedAt: new Date(),
      coverAssetId: coverAsset?.id,
    },
    update: {
      name: "Nutri",
      description:
        "Capacitacion administrable para el bot de WhatsApp enfocada en nutricion y expendios escolares.",
      status: CourseStatus.ACTIVE,
      isActive: true,
      activatedAt: new Date(),
      coverAssetId: coverAsset?.id,
      archivedAt: null,
    },
  });

  await prisma.course.updateMany({
    where: {
      id: { not: course.id },
      isActive: true,
    },
    data: {
      isActive: false,
      activatedAt: null,
      status: CourseStatus.DRAFT,
    },
  });

  await prisma.courseTransition.deleteMany({
    where: {
      step: {
        module: {
          courseId: course.id,
        },
      },
    },
  });
  await prisma.courseStep.deleteMany({
    where: {
      module: {
        courseId: course.id,
      },
    },
  });
  await prisma.courseModule.deleteMany({
    where: {
      courseId: course.id,
    },
  });

  const moduleIdBySlug = new Map<string, string>();
  for (const [index, moduleSeed] of nutriCourseModules.entries()) {
    const introAssetPath =
      moduleSeed.slug === "bienvenida" ? "/training-assets/nutri.jpeg" : null;
    const introAsset = introAssetPath
      ? await prisma.asset.findUnique({
          where: { url: `public:${introAssetPath}`.replace("public:/", "public://") },
          select: { id: true },
        })
      : null;

    const courseModule = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        slug: moduleSeed.slug,
        title: moduleSeed.title,
        summary: moduleSeed.summary,
        sortOrder: index + 1,
        introAssetId: introAsset?.id,
      },
    });
    moduleIdBySlug.set(moduleSeed.slug, courseModule.id);
  }

  const stepIdByKey = new Map<string, string>();
  for (const moduleSeed of nutriCourseModules) {
    const moduleId = moduleIdBySlug.get(moduleSeed.slug);

    if (!moduleId) {
      throw new Error(`Missing module mapping for ${moduleSeed.slug}`);
    }

    for (const [index, stepKey] of moduleSeed.stepKeys.entries()) {
      const flowStep = welcomeFlow.steps.find((step) => step.key === stepKey);
      const template = templateByKey.get(stepKey);

      if (!flowStep || !template) {
        throw new Error(`Missing course seed step or template for ${stepKey}`);
      }

      const mediaAsset = template.mediaUrl
        ? await prisma.asset.findUnique({
            where: {
              url: `public://${template.mediaUrl.replace(/^\//, "")}`,
            },
            select: { id: true },
          })
        : null;

      const courseStep = await prisma.courseStep.create({
        data: {
          moduleId,
          slug: flowStep.key,
          title: flowStep.name,
          stepType: flowStep.isAssessmentResult
            ? CourseStepType.RESULT
            : flowStep.correctAnswer
              ? CourseStepType.QUESTION
              : flowStep.isTerminal
                ? CourseStepType.SYSTEM
                : CourseStepType.CONTENT,
          sortOrder: index + 1,
          body: template.body,
          kind: template.kind,
          deliveryMode: template.deliveryMode ?? TemplateDeliveryMode.STANDARD,
          renderMode: flowStep.renderMode ?? FlowStepRenderMode.TEXT,
          inputType: flowStep.inputType,
          mediaAssetId: mediaAsset?.id,
          mediaUrl: template.mediaUrl ?? null,
          captureKey: flowStep.captureKey ?? null,
          assessmentKey: flowStep.assessmentKey ?? null,
          correctAnswer: flowStep.correctAnswer ?? null,
          scoreWeight: flowStep.scoreWeight ?? null,
          isAssessmentResult: flowStep.isAssessmentResult ?? false,
          isTerminal: flowStep.isTerminal,
          isActive: true,
        },
      });

      stepIdByKey.set(flowStep.key, courseStep.id);
    }
  }

  for (const transition of welcomeFlow.transitions) {
    const sourceStepId = stepIdByKey.get(transition.stepKey);
    const nextStepId = stepIdByKey.get(transition.nextStepKey);

    if (!sourceStepId || !nextStepId) {
      throw new Error(
        `Missing course step mapping for transition ${transition.stepKey} -> ${transition.nextStepKey}`,
      );
    }

    await prisma.courseTransition.create({
      data: {
        stepId: sourceStepId,
        nextStepId,
        matchType: transition.matchType,
        pattern: transition.pattern,
        displayLabel: getTransitionDisplayLabel(transition.pattern, transition.outputValue),
        displayHint: getTransitionDisplayHint(transition.pattern, transition.outputValue),
        outputValue: transition.outputValue ?? null,
        priority: transition.priority,
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
