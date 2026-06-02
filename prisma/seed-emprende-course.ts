import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  BotRuleMatchType,
  CourseStatus,
  CourseStepType,
  FlowStepInputType,
  FlowStepRenderMode,
  PrismaClient,
  TemplateDeliveryMode,
  TemplateKind,
} from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the Emprende course.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type EmprendeStepSeed = {
  slug: string;
  title: string;
  body: string;
  stepType?: CourseStepType;
  kind?: TemplateKind;
  deliveryMode?: TemplateDeliveryMode;
  renderMode?: FlowStepRenderMode;
  inputType?: FlowStepInputType;
  captureKey?: string;
  assessmentKey?: string;
  correctAnswer?: string;
  scoreWeight?: number;
  isAssessmentResult?: boolean;
  isTerminal?: boolean;
  transitions?: EmprendeTransitionSeed[];
};

type EmprendeTransitionSeed = {
  pattern: string;
  nextStepSlug: string;
  matchType?: BotRuleMatchType;
  outputValue?: string;
  displayLabel?: string;
  displayHint?: string;
  priority?: number;
};

type EmprendeModuleSeed = {
  slug: string;
  title: string;
  summary: string;
  steps: EmprendeStepSeed[];
};

function next(pattern: string, nextStepSlug: string, label?: string): EmprendeTransitionSeed {
  return {
    pattern,
    nextStepSlug,
    matchType: BotRuleMatchType.EXACT,
    outputValue: label ?? pattern,
    displayLabel: label ?? pattern,
    priority: 1,
  };
}

function continueButton(nextStepSlug: string, label = "Vamos") {
  return [next(label.toLowerCase(), nextStepSlug, label)];
}

function yesButton(nextStepSlug: string) {
  return [next("si", nextStepSlug, "Sí")];
}

function likertTransitions(nextStepSlug: string): EmprendeTransitionSeed[] {
  return [
    { pattern: "1", nextStepSlug, outputValue: "1", displayLabel: "Malo o deficiente", priority: 1 },
    { pattern: "2", nextStepSlug, outputValue: "2", displayLabel: "Regular", priority: 2 },
    { pattern: "3", nextStepSlug, outputValue: "3", displayLabel: "Bueno", priority: 3 },
    { pattern: "4", nextStepSlug, outputValue: "4", displayLabel: "Muy bueno", priority: 4 },
    { pattern: "5", nextStepSlug, outputValue: "5", displayLabel: "Excelente", priority: 5 },
  ];
}

function trueFalseTransitions(input: {
  nextStepSlug: string;
  falsePriority?: number;
  truePriority?: number;
}): EmprendeTransitionSeed[] {
  return [
    {
      pattern: "falso",
      nextStepSlug: input.nextStepSlug,
      outputValue: "Falso",
      displayLabel: "Falso",
      priority: input.falsePriority ?? 1,
    },
    {
      pattern: "verdadero",
      nextStepSlug: input.nextStepSlug,
      outputValue: "Verdadero",
      displayLabel: "Verdadero",
      priority: input.truePriority ?? 2,
    },
  ];
}


const courseModules: EmprendeModuleSeed[] = [
  {
    slug: "bienvenida",
    title: "Bienvenida y arranque",
    summary: "Presentación de Soberana, objetivos del curso e instrucciones de uso del chat.",
    steps: [
      {
        slug: "emprende_welcome_image_placeholder",
        title: "Imagen bienvenida",
        body: "[PENDIENTE_IMAGEN_BIENVENIDA_EMPRENDE]",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_welcome_intro", "Continuar"),
      },
      {
        slug: "emprende_welcome_intro",
        title: "Bienvenida Emprende",
        body: "¡Hola EMPRENDEdora! 💜\nSoy Soberana, tu asistente de ACYGP Entidad Certificadora.\n\n🎊🔓 ¡Qué gusto tenerte aquí! Soy tu facilitadora virtual. 🤖📲\nEstás en el nivel inicial de tu capacitación.\n\n👩🏽‍🏫 Durante tu capacitación recorrerás 3 módulos:\n1️⃣ Conceptualización del modelo de negocio para PyME'S.\n2️⃣ Desarrollo de modelos de negocio para PyME'S.\n3️⃣ Autocuidado y autoestima para emprender.\n\n💡 Si durante el recorrido necesitas ayuda, escribe la palabra AYUDA aquí en WhatsApp. 🆘",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_start_instructions", "Sí vamos"),
      },
      {
        slug: "emprende_start_instructions",
        title: "Instrucciones de avance",
        body: "¡Tú decides en qué momento avanzar!\n⏰ Puedes dedicarle 60 minutos al día.\n✍🏽 Te recomiendo tener una libreta para anotar todo lo que vas aprendiendo.\n😉 ¿Estás lista para emprender este nuevo recorrido?\n\n⭐ Para iniciar ahora presiona Sí vamos. ¡Anímate! 👇🏼",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_materials_intro", "Sí vamos"),
      },
      {
        slug: "emprende_materials_intro",
        title: "Materiales e instrucciones",
        body: "¡Excelente!\n😉 De ahora en adelante te presentaré videos, audios, infografías, imágenes y algunas lecturas. ⏯️ 🖼️ 📖\n👀 Para ver los videos deberás presionar en los enlaces cada vez que te aparezcan.\n💡⚠️ No olvides que luego de ver cada video siempre debes regresar aquí a este chat de WhatsApp para seguir aprendiendo. 📱\n\nEste curso es una gran oportunidad para aumentar tus ventas. 🤑\n\nSi estás lista/o avísame. 👇🏼",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_reminders", "¡Vamos!"),
      },
      {
        slug: "emprende_reminders",
        title: "Recordatorio de continuidad",
        body: "🤖📲 ¡Antes de olvidarme!\n⚠️ Es importante que sepas que si abandonas el chat por más de 24 horas, podrías perder tus avances y tendrías que regresar a tu capacitación desde cero. 😓\n😉 Te enviaremos algunos recordatorios para ayudarte a continuar. 💡\n➡️ Te recomiendo ir avanzando de a poquito con los minutos libres que tengas al día. ⏰",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_1_intro", "Vamos"),
      },
    ],
  },
  {
    slug: "modulo-1",
    title: "Módulo 1 - Conceptualización del modelo de negocio",
    summary: "Modelo de negocios, CANVAS, objetivos SMART e identificación de ingresos y oportunidades.",
    steps: [
      {
        slug: "emprende_module_1_intro",
        title: "Inicio módulo 1",
        body: "Recuerda seguir las instrucciones únicamente de este chat.\n\n⭐ Comenzamos con el módulo 1️⃣: Conceptualización del modelo de negocio para PyME'S.\nAl finalizar podrás desbloquear el Módulo II.\n\n🟢 Mira el video seleccionando el link y aprenderás los conceptos básicos de:\n✅ Modelo de negocios y su importancia.\n✅ Elementos que lo componen.\n✅ Herramientas para la creación de un modelo de negocios.\n✅ Propuesta de valor de acuerdo al Modelo CANVAS de Osterwalder.\n✅ Redacción de objetivos bajo el método SMART.\n\n[PENDIENTE_LINK_VIDEO_MODELO_NEGOCIO]\n\nEmprendedora, avísame si estás lista para avanzar. 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_1_infographic", "¡Avanzar!"),
      },
      {
        slug: "emprende_module_1_infographic",
        title: "Infografía modelo de negocios",
        body: "🟢 Descarga la infografía de los pasos para elaborar tu modelo de negocios.\n[PENDIENTE_LINK_INFOGRAFIA_MODELO_NEGOCIOS]\n\n📌 Test\nINSTRUCCIONES: Lee cuidadosamente y selecciona la respuesta correcta.",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_1_q1", "Iniciar test"),
      },
      {
        slug: "emprende_module_1_q1",
        title: "Módulo 1 pregunta 1",
        body: "💡 ¿Un modelo de negocios permite comprender cómo generar ingresos, identificar oportunidades de mercado, optimizar recursos y atraer inversiones?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule1Q1",
        assessmentKey: "emprende_module_1",
        correctAnswer: "Verdadero",
        scoreWeight: 34,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_1_q2" }),
      },
      {
        slug: "emprende_module_1_q2",
        title: "Módulo 1 pregunta 2",
        body: "💡 ¿El modelo CANVAS es una herramienta estratégica para llevar el control financiero de tu emprendimiento?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule1Q2",
        assessmentKey: "emprende_module_1",
        correctAnswer: "Falso",
        scoreWeight: 33,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_1_q3" }),
      },
      {
        slug: "emprende_module_1_q3",
        title: "Módulo 1 pregunta 3",
        body: "💡 ¿El método SMART establece metas claras, realistas y medibles?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule1Q3",
        assessmentKey: "emprende_module_1",
        correctAnswer: "Verdadero",
        scoreWeight: 33,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_1_result" }),
      },
      {
        slug: "emprende_module_1_result",
        title: "Resultado módulo 1",
        body: "🏆 WOW Emprendedora, concluiste con el Módulo 1️⃣.\n\nResultado de tu test:\nRespuestas correctas: {{evaluationCorrectAnswers}} de {{evaluationTotalQuestions}}\nPorcentaje final: {{evaluationPercentage}}%\n\nAhora vamos al Módulo II.",
        stepType: CourseStepType.RESULT,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "emprende_module_1",
        isAssessmentResult: true,
        transitions: continueButton("emprende_module_2_intro", "¡Vamos!"),
      },
    ],
  },
  {
    slug: "modulo-2",
    title: "Módulo 2 - Desarrollo de modelos de negocio",
    summary: "Filosofía del emprendimiento, FODA, mercadotecnia, aspectos legales, recursos y sustentabilidad.",
    steps: [
      {
        slug: "emprende_module_2_intro",
        title: "Inicio módulo 2",
        body: "🤩 Fantástico. ¡Vamos al Módulo 2️⃣: Desarrollo de modelos de negocio para PyME'S!\n\n✨ Te invito a identificar 5 ejemplos de negocios locales:\n1️⃣ _____________________\n2️⃣ _____________________\n3️⃣ _____________________\n4️⃣ _____________________\n5️⃣ _____________________\n\n🟢 Mira el video seleccionando el link y aprenderás a realizar la filosofía y un análisis FODA de tu emprendimiento.\n[PENDIENTE_LINK_VIDEO_FODA]\n\n¡Me encanta tu progreso!\n¿Seguimos? 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: yesButton("emprende_module_2_strategy"),
      },
      {
        slug: "emprende_module_2_strategy",
        title: "Estrategias y mercadotecnia",
        body: "🟢 Emprendedora, te invito a descargar la infografía sobre las estrategias de tu modelo de negocio.\n[PENDIENTE_LINK_INFOGRAFIA_ESTRATEGIAS]\n\n🏆 ¿Lista para seguir aprendiendo?\n👀 Te comparto este audio sobre aspectos importantes de la mercadotecnia del modelo de negocio:\n[PENDIENTE_LINK_AUDIO_MERCADOTECNIA]\n\nExcelente. ¿Avanzamos? 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_2_legal", "¡Vamos!"),
      },
      {
        slug: "emprende_module_2_legal",
        title: "Aspectos legales, financieros y operativos",
        body: "🟢 Emprendedora, te invito a descargar la infografía de los aspectos legales, financieros y operativos del modelo de negocio.\n[PENDIENTE_LINK_INFOGRAFIA_ASPECTOS_NEGOCIO]\n\nTómate tu tiempo. Cuando termines selecciona continuar. 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_2_resources", "Continuar"),
      },
      {
        slug: "emprende_module_2_resources",
        title: "Recursos y sustentabilidad",
        body: "🟢 Emprendedora, selecciona el link para ver este video y descubre las definiciones de recursos requeridos del modelo de negocio.\n[PENDIENTE_LINK_VIDEO_RECURSOS]\n\n🤩 Vamos a conocer las definiciones de los aspectos relacionados con la sustentabilidad/sostenibilidad del modelo de negocio.\n\n✨ Ahora vas a diseñar tu modelo de negocio.\n🟢 Descarga tu hoja de trabajo:\n[PENDIENTE_LINK_HOJA_MODELO_NEGOCIO]\n\n✨ ¡No pierdas la motivación en este avance! 💗\n👩🏽‍🏫 Seguiremos aprendiendo con la misma dinámica: videos, imágenes, audios, infografías y algunas lecturas. No olvides seguir tomando nota. 😉✍🏽\n\n📌 Ejercicio\nEmprendedora, lo estás haciendo espectacular. Vamos a desarrollar el FODA de tu emprendimiento.\n\nFortalezas: _____________________\nDebilidades: _____________________\nOportunidades: _____________________\nAmenazas: _____________________\n\nAl terminar, dame un aviso para continuar. 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_2_tere_cazola", "¡Vamos!"),
      },
      {
        slug: "emprende_module_2_tere_cazola",
        title: "Video Tere Cazola",
        body: "☺️ ¡Wow, eres poderosa!\n🟢 Descarga este video de Tere Cazola, una grande como tú:\nhttps://www.youtube.com/watch?v=L8yqhHuJ0hM\n\nSi estás lista, avísame. 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_3_intro", "¡Vamos!"),
      },
    ],
  },
  {
    slug: "modulo-3",
    title: "Módulo 3 - Autocuidado y autoestima para emprender",
    summary: "Autocuidado, autoestima, fortalezas personales y evaluación del cierre formativo.",
    steps: [
      {
        slug: "emprende_module_3_intro",
        title: "Inicio módulo 3",
        body: "¡Vamos al Módulo 3️⃣: Autocuidado y autoestima para emprender!\n\n🟢 Selecciona el link y descarga la infografía sobre autocuidado y autoestima para emprender:\n[PENDIENTE_LINK_INFOGRAFIA_AUTOCUIDADO]\n\n💗 ¡Emprendedora, reconócete y celébrate!\n✅ Escribe los elogios o halagos que recuerdes que te hayan dicho otras personas a lo largo de tu vida.\n✅ Escribe cosas que te hagan sentir orgullosa.\n\nExcelente Emprendedora. Tómate tu tiempo. Cuando termines selecciona continuar. 👇🏼",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_3_powerful_women", "Continuar"),
      },
      {
        slug: "emprende_module_3_powerful_women",
        title: "10 lecciones mujer poderosa",
        body: "🟢 Selecciona el link sobre “Las 10 lecciones que toda mujer poderosa debe saber”.\nhttps://www.youtube.com/watch?v=hoSK5r83Ho4\n\n🤩 Emprendedora, identifica emociones asociadas a emprender y nombra 3 fortalezas personales:\n1️⃣ _____________________\n2️⃣ _____________________\n3️⃣ _____________________\n\n🚨 Si deseas avanzar, por favor selecciona donde dice Continuar aquí abajo. No selecciones otro botón; sigue mis instrucciones. 👇🏼⏰\n\n¿Deseas continuar aprendiendo?",
        deliveryMode: TemplateDeliveryMode.LINK_ONLY,
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_3_evaluation_intro", "Continuar"),
      },
      {
        slug: "emprende_module_3_evaluation_intro",
        title: "Evaluación módulo 3",
        body: "📚 ¡Ya llega la evaluación!\n⏰ En caso de que necesites revisar el material, puedes tomar unos minutos para hacerlo.\nY ya sabes: avísame si continuamos. 👇🏼\n\n📌 Test\nINSTRUCCIONES: Lee cuidadosamente y selecciona si la respuesta es Verdadero o Falso.",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_module_3_q1", "¡Vamos!"),
      },
      {
        slug: "emprende_module_3_q1",
        title: "Módulo 3 pregunta 1",
        body: "1️⃣ ¿El autocuidado comprende acciones que una persona realiza para mantener, mejorar o restaurar su salud mental, física y emocional?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule3Q1",
        assessmentKey: "emprende_module_3",
        correctAnswer: "Verdadero",
        scoreWeight: 34,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_3_q2" }),
      },
      {
        slug: "emprende_module_3_q2",
        title: "Módulo 3 pregunta 2",
        body: "2️⃣ ¿El autocuidado social trata de todo lo relacionado a cómo cuidas de ti a partir de la relación con otras personas?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule3Q2",
        assessmentKey: "emprende_module_3",
        correctAnswer: "Verdadero",
        scoreWeight: 33,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_3_q3" }),
      },
      {
        slug: "emprende_module_3_q3",
        title: "Módulo 3 pregunta 3",
        body: "3️⃣ ¿El autocuidado mental se asocia con lo cognitivo y abarca todo lo relacionado con nutrir tu mente y fortalecer tu cerebro?",
        stepType: CourseStepType.QUESTION,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "emprendeModule3Q3",
        assessmentKey: "emprende_module_3",
        correctAnswer: "Verdadero",
        scoreWeight: 33,
        transitions: trueFalseTransitions({ nextStepSlug: "emprende_module_3_result" }),
      },
      {
        slug: "emprende_module_3_result",
        title: "Resultado módulo 3",
        body: "💗 ¡Wow, Emprendedora, estás llegando al final!\n\nResultado de tu test:\nRespuestas correctas: {{evaluationCorrectAnswers}} de {{evaluationTotalQuestions}}\nPorcentaje final: {{evaluationPercentage}}%\n\nExcelente Emprendedora. Tómate tu tiempo y cuando termines selecciona continuar. 👇🏼",
        stepType: CourseStepType.RESULT,
        renderMode: FlowStepRenderMode.AUTO,
        assessmentKey: "emprende_module_3",
        isAssessmentResult: true,
        transitions: continueButton("emprende_final_actions", "Continuar"),
      },
      {
        slug: "emprende_final_actions",
        title: "Acciones de crecimiento",
        body: "🟢 Para cerrar este curso te invito a escribir 5 acciones que vas a realizar para seguir creciendo como mujer emprendedora:\n1️⃣ _____________________\n2️⃣ _____________________\n3️⃣ _____________________\n4️⃣ _____________________\n5️⃣ _____________________\n\n🤩 Emprendedora, eres visionaria, resiliente, imparable y audaz.\nSi estás lista, avísame. 👇🏼",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_survey_intro", "¡Vamos!"),
      },
    ],
  },
  {
    slug: "encuesta",
    title: "Encuesta de satisfacción",
    summary: "Valoración final del curso y experiencia del chatbot.",
    steps: [
      {
        slug: "emprende_survey_intro",
        title: "Introducción encuesta",
        body: "Encuesta de satisfacción\n\nTu opinión es muy importante. 🙌 Queremos conocer tu experiencia en este curso para seguir mejorando la calidad de nuestra enseñanza.\n\nModo: Anónima\nInstrucciones: selecciona la opción de respuesta que consideres.\n\n1 = Malo/Deficiente\n2 = Regular\n3 = Bueno\n4 = Muy bueno\n5 = Excelente",
        renderMode: FlowStepRenderMode.AUTO,
        transitions: continueButton("emprende_survey_q1", "Iniciar encuesta"),
      },
      {
        slug: "emprende_survey_q1",
        title: "Encuesta pregunta 1",
        body: "1.- Haz valoración del conjunto del curso:\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ1",
        transitions: likertTransitions("emprende_survey_q2"),
      },
      {
        slug: "emprende_survey_q2",
        title: "Encuesta pregunta 2",
        body: "2.- ¿Ha cumplido el temario sus expectativas sobre este curso?\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ2",
        transitions: likertTransitions("emprende_survey_q3"),
      },
      {
        slug: "emprende_survey_q3",
        title: "Encuesta pregunta 3",
        body: "3.- ¿Considera que con lo aprendido en el curso le servirá en el ámbito laboral?\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ3",
        transitions: likertTransitions("emprende_survey_q4"),
      },
      {
        slug: "emprende_survey_q4",
        title: "Encuesta pregunta 4",
        body: "4.- Valoración de los materiales del curso, videos, audios e infografías:\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ4",
        transitions: likertTransitions("emprende_survey_q5"),
      },
      {
        slug: "emprende_survey_q5",
        title: "Encuesta pregunta 5",
        body: "5.- Valoración de la atención recibida durante el curso:\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ5",
        transitions: likertTransitions("emprende_survey_q6"),
      },
      {
        slug: "emprende_survey_q6",
        title: "Encuesta pregunta 6",
        body: "6.- Valoración de la accesibilidad del chatbot:\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ6",
        transitions: likertTransitions("emprende_completion"),
      },
      {
        slug: "emprende_completion",
        title: "Cierre Emprende",
        body: "🎉 ¡Gracias por completar el curso Emprende!\nTus respuestas quedaron registradas.\nSi deseas volver a comenzar o elegir otro curso, responde MENU.",
        stepType: CourseStepType.SYSTEM,
        kind: TemplateKind.TEXT,
        renderMode: FlowStepRenderMode.TEXT,
        isTerminal: true,
      },
    ],
  },
];

function getAllSteps() {
  return courseModules.flatMap((moduleSeed) => moduleSeed.steps);
}

async function main() {
  const existingActive = await prisma.course.findFirst({
    where: { isActive: true },
    select: { id: true, slug: true },
  });

  const course = await prisma.course.upsert({
    where: { slug: "emprende" },
    create: {
      slug: "emprende",
      name: "Emprende",
      description:
        "Capacitación administrable para WhatsApp enfocada en emprendimiento, modelos de negocio para PyME'S, autocuidado y autoestima.",
      status: CourseStatus.DRAFT,
      isActive: false,
      activatedAt: null,
      archivedAt: null,
    },
    update: {
      name: "Emprende",
      description:
        "Capacitación administrable para WhatsApp enfocada en emprendimiento, modelos de negocio para PyME'S, autocuidado y autoestima.",
      status: existingActive?.slug === "emprende" ? CourseStatus.ACTIVE : CourseStatus.DRAFT,
      isActive: existingActive?.slug === "emprende",
      archivedAt: null,
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
  await prisma.courseStep.deleteMany({ where: { module: { courseId: course.id } } });
  await prisma.courseModule.deleteMany({ where: { courseId: course.id } });

  const moduleIdBySlug = new Map<string, string>();
  const stepIdBySlug = new Map<string, string>();
  const allStepSlugs = new Set(getAllSteps().map((step) => step.slug));

  for (const [moduleIndex, moduleSeed] of courseModules.entries()) {
    const createdModule = await prisma.courseModule.create({
      data: {
        courseId: course.id,
        slug: moduleSeed.slug,
        title: moduleSeed.title,
        summary: moduleSeed.summary,
        sortOrder: moduleIndex + 1,
      },
    });

    moduleIdBySlug.set(moduleSeed.slug, createdModule.id);

    for (const [stepIndex, stepSeed] of moduleSeed.steps.entries()) {
      const createdStep = await prisma.courseStep.create({
        data: {
          moduleId: createdModule.id,
          slug: stepSeed.slug,
          title: stepSeed.title,
          stepType: stepSeed.stepType ?? CourseStepType.CONTENT,
          sortOrder: stepIndex + 1,
          body: stepSeed.body,
          kind: stepSeed.kind ?? TemplateKind.TWILIO_CONTENT_TEMPLATE,
          deliveryMode: stepSeed.deliveryMode ?? TemplateDeliveryMode.STANDARD,
          renderMode: stepSeed.renderMode ?? FlowStepRenderMode.AUTO,
          inputType: stepSeed.inputType ?? FlowStepInputType.CHOICE,
          captureKey: stepSeed.captureKey ?? null,
          assessmentKey: stepSeed.assessmentKey ?? null,
          correctAnswer: stepSeed.correctAnswer ?? null,
          scoreWeight: stepSeed.scoreWeight ?? null,
          isAssessmentResult: stepSeed.isAssessmentResult ?? false,
          isTerminal: stepSeed.isTerminal ?? false,
          isActive: true,
        },
      });

      stepIdBySlug.set(stepSeed.slug, createdStep.id);
    }
  }

  for (const moduleSeed of courseModules) {
    for (const stepSeed of moduleSeed.steps) {
      const stepId = stepIdBySlug.get(stepSeed.slug);

      if (!stepId) {
        throw new Error(`Missing seeded step ${stepSeed.slug}`);
      }

      const transitions = stepSeed.transitions ?? [];

      for (const [transitionIndex, transition] of transitions.entries()) {
        if (!allStepSlugs.has(transition.nextStepSlug)) {
          throw new Error(
            `Transition ${stepSeed.slug} points to missing step ${transition.nextStepSlug}`,
          );
        }

        await prisma.courseTransition.create({
          data: {
            stepId,
            nextStepId: stepIdBySlug.get(transition.nextStepSlug) ?? null,
            matchType: transition.matchType ?? BotRuleMatchType.EXACT,
            pattern: transition.pattern,
            displayLabel: transition.displayLabel ?? null,
            displayHint: transition.displayHint ?? null,
            outputValue: transition.outputValue ?? null,
            priority: transition.priority ?? transitionIndex + 1,
            isActive: true,
          },
        });
      }
    }
  }

  console.log("Seeded Emprende course.");
  console.table({
    courseSlug: course.slug,
    status: existingActive?.slug === "emprende" ? "ACTIVE" : "DRAFT",
    modules: courseModules.length,
    steps: getAllSteps().length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
