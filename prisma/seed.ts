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
    name: "Capacitacion - Bienvenida inicial",
    body: "🎊🔓 ¡Que gusto tenerte aqui! Soy tu facilitadora virtual. 🤖📲\nEstas en el nivel inicial de tu capacitacion.\n👩🏽‍🏫 Durante tu capacitacion recorreras 4 modulos:\nI.- Verificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.\nII.- Ejecucion de practicas higienicas antes de preparar alimentos en el expendio escolar.\nIII.- Preparacion de alimentos y bebidas nutritivas de acuerdo con la normatividad para expendios escolares.\nIV.- Proporcionar los alimentos a la comunidad escolar en el expendio.\n💡 Si durante el recorrido necesitas ayuda, escribe la palabra AYUDA aqui en WhatsApp.\n\n¡Tu decides en que momento avanzar!\n⏰ Puedes dedicarle 60 minutos al dia.\n✍🏽 Te recomiendo tener una libreta para anotar todo lo que vas aprendiendo.\n😉 ¿Estas lista/o para emprender este nuevo recorrido?\n⭐ Para iniciar ahora presiona Si vamos o escribe: SI VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.MEDIA_FIRST,
    mediaUrl: "/training-assets/nutri.jpeg",
    twilioContentSid: null,
  },
  {
    key: "training_materials_intro",
    name: "Capacitacion - Materiales e instrucciones",
    body: "¡Excelente!\n😉 De ahora en adelante te presentare videos, audios, infografias, imagenes y algunas lecturas. ⏯️ 🖼️ 📖\n👀 Para ver los videos deberas presionar en los enlaces de color azul cada vez que te aparezcan. 🔵\n💡⚠️ No olvides que luego de ver cada video siempre debes regresar aqui a este chat en WhatsApp para seguir aprendiendo. 📱\n\n🤖📲 ¡Antes de olvidarme!\n⚠️ Es importante que sepas que si abandonas el chat por mas de 24 horas, podrias perder tus avances y tendrias que regresar a tu capacitacion desde cero. 😓\n😉 Te enviaremos algunos recordatorios para ayudarte a continuar. 💡\n➡️ Te recomiendo ir avanzando de a poquitos con los minutos libres que tengas al dia. ⏰\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_1_intro",
    name: "Modulo 1 - Introduccion",
    body: "Recuerda seguir las instrucciones unicamente de este chat.\n⭐ Comenzamos con el modulo I:\nVerificacion de condiciones para la preparacion de alimentos higienicamente en el expendio escolar.\nEncontraras 12 temas y al finalizar podras desbloquear el Modulo II.\n\n➡️ Te comparto la infografia adjunta para aprender los conceptos basicos de higiene, nutricion, centro escolar, cooperativa o tienda escolar, cafeteria escolar, dieta, alimentacion, nutricion, fauna nociva, practicas de higiene personal y utensilios.\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-1-conceptos-basicos.png",
    twilioContentSid: null,
  },
  {
    key: "training_cafeteria_experience",
    name: "Modulo 1 - Experiencia cafeteria",
    body: "¿Hace cuanto tiempo tienes tu cafeteria?\n1) Menos de 6 meses\n2) Entre 6 meses y 1 ano\n3) Entre 1 y 2 anos\n4) Mas de 2 anos\n\n¿Seguimos? 👇🏼",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_eta_audio",
    name: "Modulo 1 - Audio ETAs",
    body: "😉 Te recomiendo tomar nota en tu libreta para que no te pierdas de nada.\n👀 Te comparto el audio sobre las Enfermedades transmitidas por los alimentos (ETA's).\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    mediaUrl: "/training-assets/audio-nutri.mp3",
    twilioContentSid: null,
  },
  {
    key: "training_eta_activity",
    name: "Modulo 1 - Infografia ETAs",
    body: "➡️ Te comparto la infografia adjunta de las principales enfermedades transmitidas por alimentos.\nTomate tu tiempo y cuando termines escribe: CONTINUAR.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-1-eta-infografia.png",
    twilioContentSid: null,
  },
  {
    key: "training_food_handling_audio",
    name: "Modulo 1 - Manejo higienico",
    body: "➡️ Selecciona el link para escuchar el audio y descubrir el manejo higienico de los alimentos.\n[PENDIENTE_AUDIO_MANEJO_HIGIENICO]\n\nAl terminar dame un aviso para continuar. 👇🏼\n¡Continuemos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_regulation_intro",
    name: "Modulo 1 - Marco normativo",
    body: "✅ Aprenderas sobre el marco normativo en Mexico para la higiene y preparacion de alimentos. Se basa en la Ley General de Salud y en la NOM-251-SSA1-2009, que establece las practicas obligatorias de higiene para el proceso de alimentos, bebidas o suplementos.\nEsta norma contempla instalaciones, equipos, personal y control de operaciones para garantizar la inocuidad.\n\n⭐ Descarga la norma:\nhttps://dof.gob.mx/nota_detalle.php%3Fcodigo%3D5133449%26fecha%3D01/03/2010&print=true\n\nTomate tu tiempo y cuando termines selecciona CONTINUAR.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_hygiene_summary",
    name: "Modulo 1 - Resumen higiene",
    body: "✅ Los equipos, utensilios y superficies en contacto con alimentos deben ser de materiales lisos, no porosos y de facil limpieza.\n✅ Deben lavarse y desinfectarse para evitar contaminacion.\n✅ Las instalaciones, incluyendo pisos, paredes y techos, deben mantenerse limpias y en buen estado.\n✅ Es obligatorio el lavado de manos del personal antes de iniciar labores, al regresar de ausencias y despues de manipular material sucio.\n✅ Los establecimientos deben contar con agua potable para la limpieza y desinfeccion.\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_cleaning_audio",
    name: "Modulo 1 - Audio limpieza y desinfeccion",
    body: "✅ ➡️ Selecciona el link para escuchar el audio y descubrir como es el procedimiento de limpieza y desinfectado especifico para instalaciones, equipos y transporte.\n[PENDIENTE_AUDIO_LIMPIEZA_DESINFECCION]\nhttps://capacitateparaelempleo.org/cursos/view/120\n\nAhora hagamos una calendarizacion y frecuencia por area o por equipo con la persona responsable de llevarlo a cabo.\n😉 Descarga el formato y trabajemos:\n[PENDIENTE_LINK_PLAN_DE_TRABAJO]\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_drying_video",
    name: "Modulo 1 - Video limpieza y secado",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el proceso de limpieza y secado.\nhttps://capacitateparaelempleo.org/cursos/view/120\n\nCuando termines responde: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz",
    name: "Modulo 1 - Quiz secado",
    body: "✅ ➡️ Es tu turno, contesta si es Falso o Verdadero.\n💡 ¿La norma menciona que el equipo y los utensilios no se sequen al aire libre para evitar la contaminacion por trapos o panos, los cuales pueden albergar bacterias?\n\nOpciones:\n- Falso\n- Verdadero",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz_correct",
    name: "Modulo 1 - Quiz secado correcto",
    body: "✅ ¡Correcto! La respuesta es FALSO.\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_drying_quiz_incorrect",
    name: "Modulo 1 - Quiz secado incorrecto",
    body: "❌ La respuesta correcta es FALSO.\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_cross_contamination_audio",
    name: "Modulo 1 - Contaminacion cruzada",
    body: "✅ ➡️ Selecciona el link para escuchar el audio sobre que es la contaminacion cruzada.\n[PENDIENTE_AUDIO_CONTAMINACION_CRUZADA]\nhttps://capacitateparaelempleo.org/cursos/view/120\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_temperature_control",
    name: "Modulo 1 - Control de temperaturas",
    body: "✅ ➡️ Selecciona el link para ver este video y descubre el control de temperaturas de los alimentos.\nhttps://capacitateparaelempleo.org/cursos/view/120\n[PENDIENTE_LINK_CONTROL_TEMPERATURA]\n\n🚨 Si deseas avanzar, por favor selecciona donde dice CONTINUAR aqui abajo. ⏰",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_intro",
    name: "Modulo 1 - Evaluacion",
    body: "📚 ¡Ya llega la evaluacion!\n⏰ Si necesitas revisar el material, puedes tomar unos minutos para hacerlo.\n\nCuando quieras comenzar responde: TEST.\nLa evaluacion tiene 6 preguntas.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q1",
    name: "Modulo 1 - Evaluacion pregunta 1",
    body: "1.- Es un conjunto de alimentos que consumimos diariamente:\nA) Nutricion\nB) Dieta\nC) Alimentacion",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q2",
    name: "Modulo 1 - Evaluacion pregunta 2",
    body: "2.- Es el proceso donde el cuerpo transforma el alimento en energia y componentes esenciales para las celulas:\nA) Nutricion\nB) Dieta\nC) Alimentacion",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q3",
    name: "Modulo 1 - Evaluacion pregunta 3",
    body: "3.- Es el proceso consciente y voluntario de proporcionar al cuerpo los alimentos que necesita:\nA) Nutricion\nB) Dieta\nC) Alimentacion",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q4",
    name: "Modulo 1 - Evaluacion pregunta 4",
    body: "4.- Espacio fisico dentro de la institucion educativa donde se comercializan alimentos, bebidas y materiales para la comunidad escolar:\nA) Centro escolar\nB) Expendio\nC) Higiene personal",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q5",
    name: "Modulo 1 - Evaluacion pregunta 5",
    body: "5.- Institucion educativa que brinda formacion academica a distintas edades:\nA) Centro escolar\nB) Expendio\nC) Higiene personal",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_q6",
    name: "Modulo 1 - Evaluacion pregunta 6",
    body: "6.- Son las practicas diarias para cuidar el cuerpo: bano, lavado de manos, dientes, cabello, unas y oidos:\nA) Centro escolar\nB) Expendio\nC) Higiene personal",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_evaluation_result",
    name: "Modulo 1 - Evaluacion resultado",
    body: "📝 Resultado de tu evaluacion del modulo I:\nRespuestas correctas: {{evaluationCorrectAnswers}} de {{evaluationTotalQuestions}}\nPorcentaje final: {{evaluationPercentage}}%\n\nCuando quieras avanzar al modulo II, responde: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_intro",
    name: "Modulo 2 - Introduccion",
    body: "✨ ¡No pierdas la motivacion en este avance! 💗\n👩🏽‍🏫 Seguiremos aprendiendo con la misma dinamica: videos, imagenes, audios, infografias y algunas lecturas. No olvides seguir tomando nota. 😉✍🏽\n\nII.- Ejecucion de practicas higienicas antes de preparar alimentos en el expendio escolar.\n🧏🏽 Escucha este audio y descubre la importancia que tiene la higiene personal en la preparacion de alimentos.\n[PENDIENTE_AUDIO_HIGIENE_PERSONAL]\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_rules_video",
    name: "Modulo 2 - Reglas higiene personal",
    body: "✅ ➡️ Selecciona el link para ver este video y descubrir las reglas de la higiene personal.\nhttps://capacitateparaelempleo.org/cursos/view/120\n[PENDIENTE_LINK_REGLAS_HIGIENE_PERSONAL]\n\n¿Deseas continuar aprendiendo?\nCONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_quiz_intro",
    name: "Modulo 2 - Test higiene personal",
    body: "Vamos a contestar el siguiente test de higiene personal.\nCuando estes lista/o responde: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q1",
    name: "Modulo 2 - Pregunta 1",
    body: "💡 ¿Si tengo alguno de estos sintomas: gripe, tos, diarrea o infecciones de la piel, puedo preparar o servir alimentos?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q2",
    name: "Modulo 2 - Pregunta 2",
    body: "💡 ¿Si toso o estornudo, debo cubrir la boca con las manos o papel desechable y lavarme las manos antes de reanudar mis actividades?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q3",
    name: "Modulo 2 - Pregunta 3",
    body: "💡 ¿Debo bañarme todos los dias antes de comenzar mis labores?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q4",
    name: "Modulo 2 - Pregunta 4",
    body: "💡 ¿Debo lavarme las manos antes de iniciar mis labores, despues de ir al bano, despues de cada interrupcion, despues de tocar alimentos crudos y antes de manipular otros alimentos?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q5",
    name: "Modulo 2 - Pregunta 5",
    body: "💡 ¿Puedo manipular alimentos con mis unas largas y con esmalte?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q6",
    name: "Modulo 2 - Pregunta 6",
    body: "💡 ¿Mi uniforme debe estar limpio, y mi delantal y mi cofia deben ser de colores claros?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q7",
    name: "Modulo 2 - Pregunta 7",
    body: "💡 ¿Puedo usar anillos, pulseras, esclavas o relojes cuando preparo o sirvo alimentos?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_q8",
    name: "Modulo 2 - Pregunta 8",
    body: "💡 ¿Puedo fumar, comer, beber o masticar chicle cuando preparo o sirvo alimentos?\nA) SI\nB) NO",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_quiz_result",
    name: "Modulo 2 - Resultado test higiene personal",
    body: "¡Perfecto! 🥳\n💐 Gracias por tus respuestas.\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_handwashing_video",
    name: "Modulo 2 - Lavado de manos",
    body: "✅ ➡️ Selecciona el link para ver este video. Veamos la tecnica de lavado de manos.\n[PENDIENTE_LINK_TECNICA_LAVADO_MANOS]\n\nCuando termines responde: CONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_handwashing_quiz",
    name: "Modulo 2 - Cuando lavarse las manos",
    body: "✅ ➡️ Es tu turno.\n💡 ¿Cuando debemos lavarnos las manos?\n1) Solo una vez al dia al ingresar al area de trabajo\n2) Cada vez que sea necesario o cambie de tarea, por ejemplo al manipular alimentos crudos para evitar la contaminacion cruzada\n3) Solo cuando terminamos la jornada de trabajo\n4) Cuando tenga tiempo de lavarme las manos\n\nTomate tu tiempo y cuando termines selecciona CONTINUAR.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_waste_infographic",
    name: "Modulo 2 - Manejo de residuos",
    body: "✅ ➡️ Te comparto la infografia adjunta del manejo de residuos solidos.\nAl terminar dame un aviso para continuar. 👇🏼\n¡Continuemos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-2-residuos-solidos.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_2_peps_audio",
    name: "Modulo 2 - Sistema PEPS",
    body: "✅ ➡️ Selecciona el link y escucha el audio sobre el sistema PEPS.\n[PENDIENTE_AUDIO_PEPS]\n\nSi estas lista/o avísame: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_storage_video",
    name: "Modulo 2 - Almacenamiento de alimentos",
    body: "✅ ➡️ Selecciona el link para ver este video sobre el almacenamiento de alimentos.\nhttps://capacitateparaelempleo.org/cursos/view/120\n\n¿Deseas continuar aprendiendo?\nCONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_2_pests_infographic",
    name: "Modulo 2 - Control de plagas",
    body: "✅ ➡️ Te comparto la infografia adjunta sobre el control de plagas.\nAl terminar dame un aviso para continuar. 👇🏼\n¡Continuemos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-2-control-plagas.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_2_fruit_wash_infographic",
    name: "Modulo 2 - Lavado de frutas y verduras",
    body: "✅ ➡️ Te comparto la infografia adjunta sobre el lavado y desinfectado de frutas y verduras.\n🤩 ¡Me encanta!\n✨ Usa ese optimismo para llevar a la practica lo aprendido.\n💡 Recuerda llevar esa motivacion como parte de tu proceso diario.\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-2-lavado-frutas-verduras.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_3_intro",
    name: "Modulo 3 - Etiquetado nutricional",
    body: "Bienvenido/a al Modulo III. Preparacion de alimentos y bebidas nutritivas de acuerdo con la normatividad para expendios escolares.\n✅ ➡️ Te comparto la infografia adjunta sobre el etiquetado nutricional.\n\n🚨 Si deseas avanzar, por favor escribe: CONTINUAR.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-3-etiquetado-alimentos.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_3_manual",
    name: "Modulo 3 - Manual oficial",
    body: "✅ ➡️ Selecciona el link para descargar el Manual para personas que preparan, distribuyen y venden alimentos en las escuelas del Gobierno de Mexico:\nhttps://vidasaludable.gob.mx/storage/recursos/materiales/Manual-cooperativas.pdf\n\n¿Deseas continuar aprendiendo?\nCONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_3_healthy_eating",
    name: "Modulo 3 - Alimentacion saludable",
    body: "✅ ➡️ Te comparto la infografia adjunta sobre alimentacion saludable.\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-3-alimentacion-saludable.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_3_audio",
    name: "Modulo 3 - Audio preparacion de alimentos",
    body: "✅ ➡️ Selecciona el link y escucha el audio sobre la preparacion de alimentos y bebidas: frutas, verduras, leguminosas, cereales integrales y agua natural.\n[PENDIENTE_AUDIO_PREPARACION_ALIMENTOS]\n\nAl terminar dame un aviso para continuar. 👇🏼\n¡Continuemos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_3_minutario",
    name: "Modulo 3 - Minutario mensual",
    body: "Ahora es tu turno.\n➡️ Te invito a poner en practica todo lo aprendido.\n💡 Date el tiempo para crear tus propios aprendizajes.\n⏰ Ve a tu ritmo: sin prisa, pero sin pausa.\n✅ ➡️ Selecciona el link para descargar el formato para hacer tu minutario mensual con alimentos de tu region.\n[PENDIENTE_LINK_MINUTARIO_MENSUAL]\n\n¿Avanzamos? 👇🏼\n¡Vamos!",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_3_menu_video",
    name: "Modulo 3 - Elaboracion de menus",
    body: "✅ ➡️ Selecciona el link para ver este video. Te voy a guiar paso a paso para que elabores tus menus.\n[PENDIENTE_LINK_ELABORACION_MENUS]\n\nTomate tu tiempo y cuando termines selecciona CONTINUAR.",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_intro",
    name: "Modulo 4 - Introduccion",
    body: "💥 Llegaste al Modulo IV: Proporcionar los alimentos a la comunidad escolar en el expendio. Reconozco tus logros.\nAgradecete por este tiempo que estas destinando a tu crecimiento. 🚀\n➡️ Es momento de iniciar...\n✅ ➡️ Selecciona el link para ver este video sobre la atencion a la comunidad escolar.\n[PENDIENTE_LINK_ATENCION_COMUNIDAD_ESCOLAR]\n\n¿Deseas continuar aprendiendo?\nCONTINUAR",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    deliveryMode: TemplateDeliveryMode.LINK_ONLY,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_intro",
    name: "Modulo 4 - Encuesta de satisfaccion",
    body: "✅ ➡️ Te comparto la infografia adjunta de recomendaciones de la promocion de la oferta alimentaria.\n\nEncuesta de satisfaccion\nModo: Anonima\nInstrucciones: Da clic en la opcion de respuesta que consideres.\n1 = Malo o deficiente\n2 = Regular\n3 = Bueno\n4 = Muy bueno\n5 = Excelente\n\nCuando quieras comenzar responde: VAMOS",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    mediaUrl: "/training-assets/modulo-4-oferta-alimentaria.png",
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q1",
    name: "Modulo 4 - Encuesta pregunta 1",
    body: "1.- Haz una valoracion del conjunto del curso.\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q2",
    name: "Modulo 4 - Encuesta pregunta 2",
    body: "2.- ¿Ha cumplido el temario sus expectativas sobre este curso?\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q3",
    name: "Modulo 4 - Encuesta pregunta 3",
    body: "3.- ¿Considera que con lo aprendido en el curso le servira en el ambito laboral?\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q4",
    name: "Modulo 4 - Encuesta pregunta 4",
    body: "4.- Valoracion de los materiales del curso, videos, audios e infografias.\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q5",
    name: "Modulo 4 - Encuesta pregunta 5",
    body: "5.- Valoracion de la atencion recibida durante el curso.\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_survey_q6",
    name: "Modulo 4 - Encuesta pregunta 6",
    body: "6.- Valoracion de la accesibilidad del chatbot.\n1) Malo o deficiente\n2) Regular\n3) Bueno\n4) Muy bueno\n5) Excelente",
    kind: TemplateKind.TWILIO_CONTENT_TEMPLATE,
    twilioContentSid: null,
  },
  {
    key: "training_module_4_completion",
    name: "Modulo 4 - Cierre",
    body: "🎉 ¡Gracias por completar la capacitacion!\nTus respuestas quedaron registradas.\nSi deseas volver a comenzar o elegir otro curso, responde MENU.",
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

function exactTransition(
  stepKey: string,
  pattern: string,
  nextStepKey: string,
  priority: number,
  outputValue?: string,
): SeedTransition {
  return {
    stepKey,
    matchType: BotRuleMatchType.EXACT,
    pattern,
    nextStepKey,
    outputValue,
    priority,
  };
}

function keywordTransition(
  stepKey: string,
  pattern: string,
  nextStepKey: string,
  priority: number,
  outputValue?: string,
): SeedTransition {
  return {
    stepKey,
    matchType: BotRuleMatchType.KEYWORD,
    pattern,
    nextStepKey,
    outputValue,
    priority,
  };
}

function containsTransition(
  stepKey: string,
  pattern: string,
  nextStepKey: string,
  priority: number,
  outputValue?: string,
): SeedTransition {
  return {
    stepKey,
    matchType: BotRuleMatchType.CONTAINS,
    pattern,
    nextStepKey,
    outputValue,
    priority,
  };
}

function fallbackTransition(stepKey: string): SeedTransition {
  return {
    stepKey,
    matchType: BotRuleMatchType.FALLBACK,
    pattern: "*",
    nextStepKey: stepKey,
    priority: 999,
  };
}

const flowDefinitions: SeedFlow[] = [
  {
    key: "welcome",
    name: "Capacitacion Nutri",
    description:
      "Onboarding y recorrido completo del curso Nutri actualizado desde el documento fuente.",
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
        renderMode: FlowStepRenderMode.LIST_PICKER,
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
        name: "Infografia ETAs",
        templateKey: "training_eta_activity",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_food_handling_audio",
        name: "Manejo higienico",
        templateKey: "training_food_handling_audio",
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
        key: "training_cleaning_audio",
        name: "Limpieza y desinfeccion",
        templateKey: "training_cleaning_audio",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_drying_video",
        name: "Video limpieza y secado",
        templateKey: "training_drying_video",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_drying_quiz",
        name: "Quiz secado",
        templateKey: "training_drying_quiz",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
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
        key: "training_cross_contamination_audio",
        name: "Contaminacion cruzada",
        templateKey: "training_cross_contamination_audio",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_temperature_control",
        name: "Control de temperaturas",
        templateKey: "training_temperature_control",
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
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "B",
        scoreWeight: 17,
        captureKey: "evaluationQ1",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q2",
        name: "Evaluacion pregunta 2",
        templateKey: "training_evaluation_q2",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "A",
        scoreWeight: 17,
        captureKey: "evaluationQ2",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q3",
        name: "Evaluacion pregunta 3",
        templateKey: "training_evaluation_q3",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "C",
        scoreWeight: 17,
        captureKey: "evaluationQ3",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q4",
        name: "Evaluacion pregunta 4",
        templateKey: "training_evaluation_q4",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "B",
        scoreWeight: 17,
        captureKey: "evaluationQ4",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q5",
        name: "Evaluacion pregunta 5",
        templateKey: "training_evaluation_q5",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "A",
        scoreWeight: 16,
        captureKey: "evaluationQ5",
        isTerminal: false,
      },
      {
        key: "training_evaluation_q6",
        name: "Evaluacion pregunta 6",
        templateKey: "training_evaluation_q6",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        assessmentKey: "module_1_final_test",
        correctAnswer: "C",
        scoreWeight: 16,
        captureKey: "evaluationQ6",
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
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_rules_video",
        name: "Video reglas higiene personal",
        templateKey: "training_module_2_rules_video",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_quiz_intro",
        name: "Intro test higiene personal",
        templateKey: "training_module_2_quiz_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_q1",
        name: "Modulo 2 pregunta 1",
        templateKey: "training_module_2_q1",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q1",
        isTerminal: false,
      },
      {
        key: "training_module_2_q2",
        name: "Modulo 2 pregunta 2",
        templateKey: "training_module_2_q2",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q2",
        isTerminal: false,
      },
      {
        key: "training_module_2_q3",
        name: "Modulo 2 pregunta 3",
        templateKey: "training_module_2_q3",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q3",
        isTerminal: false,
      },
      {
        key: "training_module_2_q4",
        name: "Modulo 2 pregunta 4",
        templateKey: "training_module_2_q4",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q4",
        isTerminal: false,
      },
      {
        key: "training_module_2_q5",
        name: "Modulo 2 pregunta 5",
        templateKey: "training_module_2_q5",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q5",
        isTerminal: false,
      },
      {
        key: "training_module_2_q6",
        name: "Modulo 2 pregunta 6",
        templateKey: "training_module_2_q6",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q6",
        isTerminal: false,
      },
      {
        key: "training_module_2_q7",
        name: "Modulo 2 pregunta 7",
        templateKey: "training_module_2_q7",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q7",
        isTerminal: false,
      },
      {
        key: "training_module_2_q8",
        name: "Modulo 2 pregunta 8",
        templateKey: "training_module_2_q8",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.QUICK_REPLY,
        captureKey: "module2Q8",
        isTerminal: false,
      },
      {
        key: "training_module_2_quiz_result",
        name: "Modulo 2 resultado test",
        templateKey: "training_module_2_quiz_result",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_handwashing_video",
        name: "Video tecnica lavado de manos",
        templateKey: "training_module_2_handwashing_video",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_handwashing_quiz",
        name: "Pregunta lavado de manos",
        templateKey: "training_module_2_handwashing_quiz",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "module2HandwashingAnswer",
        isTerminal: false,
      },
      {
        key: "training_module_2_waste_infographic",
        name: "Infografia residuos",
        templateKey: "training_module_2_waste_infographic",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_peps_audio",
        name: "Audio sistema PEPS",
        templateKey: "training_module_2_peps_audio",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_storage_video",
        name: "Video almacenamiento alimentos",
        templateKey: "training_module_2_storage_video",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_pests_infographic",
        name: "Infografia control de plagas",
        templateKey: "training_module_2_pests_infographic",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_2_fruit_wash_infographic",
        name: "Infografia lavado frutas y verduras",
        templateKey: "training_module_2_fruit_wash_infographic",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_intro",
        name: "Inicio modulo 3",
        templateKey: "training_module_3_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_manual",
        name: "Manual oficial modulo 3",
        templateKey: "training_module_3_manual",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_healthy_eating",
        name: "Alimentacion saludable",
        templateKey: "training_module_3_healthy_eating",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_audio",
        name: "Audio preparacion de alimentos",
        templateKey: "training_module_3_audio",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_minutario",
        name: "Formato minutario",
        templateKey: "training_module_3_minutario",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_3_menu_video",
        name: "Video elaboracion menus",
        templateKey: "training_module_3_menu_video",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_4_intro",
        name: "Inicio modulo 4",
        templateKey: "training_module_4_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_intro",
        name: "Intro encuesta final",
        templateKey: "training_module_4_survey_intro",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.AUTO,
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q1",
        name: "Encuesta pregunta 1",
        templateKey: "training_module_4_survey_q1",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ1",
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q2",
        name: "Encuesta pregunta 2",
        templateKey: "training_module_4_survey_q2",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ2",
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q3",
        name: "Encuesta pregunta 3",
        templateKey: "training_module_4_survey_q3",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ3",
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q4",
        name: "Encuesta pregunta 4",
        templateKey: "training_module_4_survey_q4",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ4",
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q5",
        name: "Encuesta pregunta 5",
        templateKey: "training_module_4_survey_q5",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ5",
        isTerminal: false,
      },
      {
        key: "training_module_4_survey_q6",
        name: "Encuesta pregunta 6",
        templateKey: "training_module_4_survey_q6",
        inputType: FlowStepInputType.CHOICE,
        renderMode: FlowStepRenderMode.LIST_PICKER,
        captureKey: "surveyQ6",
        isTerminal: false,
      },
      {
        key: "training_module_4_completion",
        name: "Cierre de capacitacion",
        templateKey: "training_module_4_completion",
        inputType: FlowStepInputType.CHOICE,
        isTerminal: true,
      },
    ],
    transitions: [
      exactTransition(
        "training_welcome_intro",
        "si vamos",
        "training_materials_intro",
        1,
      ),
      keywordTransition(
        "training_welcome_intro",
        "si",
        "training_materials_intro",
        2,
      ),
      keywordTransition(
        "training_welcome_intro",
        "vamos",
        "training_materials_intro",
        3,
      ),
      fallbackTransition("training_welcome_intro"),

      exactTransition(
        "training_materials_intro",
        "vamos",
        "training_module_1_intro",
        1,
      ),
      fallbackTransition("training_materials_intro"),

      exactTransition(
        "training_module_1_intro",
        "vamos",
        "training_cafeteria_experience",
        1,
      ),
      fallbackTransition("training_module_1_intro"),

      exactTransition(
        "training_cafeteria_experience",
        "1",
        "training_eta_audio",
        1,
        "Menos de 6 meses",
      ),
      containsTransition(
        "training_cafeteria_experience",
        "menos de 6 meses",
        "training_eta_audio",
        2,
        "Menos de 6 meses",
      ),
      exactTransition(
        "training_cafeteria_experience",
        "2",
        "training_eta_audio",
        3,
        "Entre 6 meses y 1 ano",
      ),
      containsTransition(
        "training_cafeteria_experience",
        "entre 6 meses y 1 ano",
        "training_eta_audio",
        4,
        "Entre 6 meses y 1 ano",
      ),
      exactTransition(
        "training_cafeteria_experience",
        "3",
        "training_eta_audio",
        5,
        "Entre 1 y 2 anos",
      ),
      containsTransition(
        "training_cafeteria_experience",
        "entre 1 y 2 anos",
        "training_eta_audio",
        6,
        "Entre 1 y 2 anos",
      ),
      exactTransition(
        "training_cafeteria_experience",
        "4",
        "training_eta_audio",
        7,
        "Mas de 2 anos",
      ),
      containsTransition(
        "training_cafeteria_experience",
        "mas de 2 anos",
        "training_eta_audio",
        8,
        "Mas de 2 anos",
      ),
      exactTransition(
        "training_cafeteria_experience",
        "si",
        "training_eta_audio",
        9,
      ),
      fallbackTransition("training_cafeteria_experience"),

      exactTransition(
        "training_eta_audio",
        "vamos",
        "training_eta_activity",
        1,
      ),
      fallbackTransition("training_eta_audio"),

      exactTransition(
        "training_eta_activity",
        "continuar",
        "training_food_handling_audio",
        1,
      ),
      fallbackTransition("training_eta_activity"),

      exactTransition(
        "training_food_handling_audio",
        "continuemos",
        "training_regulation_intro",
        1,
      ),
      containsTransition(
        "training_food_handling_audio",
        "continuemos",
        "training_regulation_intro",
        2,
      ),
      fallbackTransition("training_food_handling_audio"),

      exactTransition(
        "training_regulation_intro",
        "continuar",
        "training_hygiene_summary",
        1,
      ),
      fallbackTransition("training_regulation_intro"),

      exactTransition(
        "training_hygiene_summary",
        "vamos",
        "training_cleaning_audio",
        1,
      ),
      fallbackTransition("training_hygiene_summary"),

      exactTransition(
        "training_cleaning_audio",
        "vamos",
        "training_drying_video",
        1,
      ),
      fallbackTransition("training_cleaning_audio"),

      exactTransition(
        "training_drying_video",
        "continuar",
        "training_drying_quiz",
        1,
      ),
      fallbackTransition("training_drying_video"),

      exactTransition(
        "training_drying_quiz",
        "falso",
        "training_drying_quiz_correct",
        1,
        "Falso",
      ),
      exactTransition(
        "training_drying_quiz",
        "verdadero",
        "training_drying_quiz_incorrect",
        2,
        "Verdadero",
      ),
      fallbackTransition("training_drying_quiz"),

      exactTransition(
        "training_drying_quiz_correct",
        "vamos",
        "training_cross_contamination_audio",
        1,
      ),
      fallbackTransition("training_drying_quiz_correct"),

      exactTransition(
        "training_drying_quiz_incorrect",
        "vamos",
        "training_cross_contamination_audio",
        1,
      ),
      fallbackTransition("training_drying_quiz_incorrect"),

      exactTransition(
        "training_cross_contamination_audio",
        "vamos",
        "training_temperature_control",
        1,
      ),
      fallbackTransition("training_cross_contamination_audio"),

      exactTransition(
        "training_temperature_control",
        "continuar",
        "training_evaluation_intro",
        1,
      ),
      fallbackTransition("training_temperature_control"),

      exactTransition(
        "training_evaluation_intro",
        "test",
        "training_evaluation_q1",
        1,
      ),
      exactTransition(
        "training_evaluation_intro",
        "vamos",
        "training_evaluation_q1",
        2,
      ),
      fallbackTransition("training_evaluation_intro"),

      exactTransition(
        "training_evaluation_q1",
        "a",
        "training_evaluation_q2",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q1",
        "b",
        "training_evaluation_q2",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q1",
        "c",
        "training_evaluation_q2",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q1"),

      exactTransition(
        "training_evaluation_q2",
        "a",
        "training_evaluation_q3",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q2",
        "b",
        "training_evaluation_q3",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q2",
        "c",
        "training_evaluation_q3",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q2"),

      exactTransition(
        "training_evaluation_q3",
        "a",
        "training_evaluation_q4",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q3",
        "b",
        "training_evaluation_q4",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q3",
        "c",
        "training_evaluation_q4",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q3"),

      exactTransition(
        "training_evaluation_q4",
        "a",
        "training_evaluation_q5",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q4",
        "b",
        "training_evaluation_q5",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q4",
        "c",
        "training_evaluation_q5",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q4"),

      exactTransition(
        "training_evaluation_q5",
        "a",
        "training_evaluation_q6",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q5",
        "b",
        "training_evaluation_q6",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q5",
        "c",
        "training_evaluation_q6",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q5"),

      exactTransition(
        "training_evaluation_q6",
        "a",
        "training_evaluation_result",
        1,
        "A",
      ),
      exactTransition(
        "training_evaluation_q6",
        "b",
        "training_evaluation_result",
        2,
        "B",
      ),
      exactTransition(
        "training_evaluation_q6",
        "c",
        "training_evaluation_result",
        3,
        "C",
      ),
      fallbackTransition("training_evaluation_q6"),

      exactTransition(
        "training_evaluation_result",
        "continuar",
        "training_module_2_intro",
        1,
      ),
      fallbackTransition("training_evaluation_result"),

      exactTransition(
        "training_module_2_intro",
        "vamos",
        "training_module_2_rules_video",
        1,
      ),
      fallbackTransition("training_module_2_intro"),

      exactTransition(
        "training_module_2_rules_video",
        "continuar",
        "training_module_2_quiz_intro",
        1,
      ),
      fallbackTransition("training_module_2_rules_video"),

      exactTransition(
        "training_module_2_quiz_intro",
        "vamos",
        "training_module_2_q1",
        1,
      ),
      fallbackTransition("training_module_2_quiz_intro"),

      exactTransition(
        "training_module_2_q1",
        "a",
        "training_module_2_q2",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q1",
        "b",
        "training_module_2_q2",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q1"),

      exactTransition(
        "training_module_2_q2",
        "a",
        "training_module_2_q3",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q2",
        "b",
        "training_module_2_q3",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q2"),

      exactTransition(
        "training_module_2_q3",
        "a",
        "training_module_2_q4",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q3",
        "b",
        "training_module_2_q4",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q3"),

      exactTransition(
        "training_module_2_q4",
        "a",
        "training_module_2_q5",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q4",
        "b",
        "training_module_2_q5",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q4"),

      exactTransition(
        "training_module_2_q5",
        "a",
        "training_module_2_q6",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q5",
        "b",
        "training_module_2_q6",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q5"),

      exactTransition(
        "training_module_2_q6",
        "a",
        "training_module_2_q7",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q6",
        "b",
        "training_module_2_q7",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q6"),

      exactTransition(
        "training_module_2_q7",
        "a",
        "training_module_2_q8",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q7",
        "b",
        "training_module_2_q8",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q7"),

      exactTransition(
        "training_module_2_q8",
        "a",
        "training_module_2_quiz_result",
        1,
        "SI",
      ),
      exactTransition(
        "training_module_2_q8",
        "b",
        "training_module_2_quiz_result",
        2,
        "NO",
      ),
      fallbackTransition("training_module_2_q8"),

      exactTransition(
        "training_module_2_quiz_result",
        "vamos",
        "training_module_2_handwashing_video",
        1,
      ),
      fallbackTransition("training_module_2_quiz_result"),

      exactTransition(
        "training_module_2_handwashing_video",
        "continuar",
        "training_module_2_handwashing_quiz",
        1,
      ),
      fallbackTransition("training_module_2_handwashing_video"),

      exactTransition(
        "training_module_2_handwashing_quiz",
        "1",
        "training_module_2_waste_infographic",
        1,
        "Solo una vez al dia",
      ),
      exactTransition(
        "training_module_2_handwashing_quiz",
        "2",
        "training_module_2_waste_infographic",
        2,
        "Cada vez que sea necesario",
      ),
      exactTransition(
        "training_module_2_handwashing_quiz",
        "3",
        "training_module_2_waste_infographic",
        3,
        "Solo al terminar la jornada",
      ),
      exactTransition(
        "training_module_2_handwashing_quiz",
        "4",
        "training_module_2_waste_infographic",
        4,
        "Cuando tenga tiempo",
      ),
      fallbackTransition("training_module_2_handwashing_quiz"),

      exactTransition(
        "training_module_2_waste_infographic",
        "continuemos",
        "training_module_2_peps_audio",
        1,
      ),
      fallbackTransition("training_module_2_waste_infographic"),

      exactTransition(
        "training_module_2_peps_audio",
        "vamos",
        "training_module_2_storage_video",
        1,
      ),
      fallbackTransition("training_module_2_peps_audio"),

      exactTransition(
        "training_module_2_storage_video",
        "continuar",
        "training_module_2_pests_infographic",
        1,
      ),
      fallbackTransition("training_module_2_storage_video"),

      exactTransition(
        "training_module_2_pests_infographic",
        "continuemos",
        "training_module_2_fruit_wash_infographic",
        1,
      ),
      fallbackTransition("training_module_2_pests_infographic"),

      exactTransition(
        "training_module_2_fruit_wash_infographic",
        "vamos",
        "training_module_3_intro",
        1,
      ),
      fallbackTransition("training_module_2_fruit_wash_infographic"),

      exactTransition(
        "training_module_3_intro",
        "continuar",
        "training_module_3_manual",
        1,
      ),
      fallbackTransition("training_module_3_intro"),

      exactTransition(
        "training_module_3_manual",
        "continuar",
        "training_module_3_healthy_eating",
        1,
      ),
      fallbackTransition("training_module_3_manual"),

      exactTransition(
        "training_module_3_healthy_eating",
        "vamos",
        "training_module_3_audio",
        1,
      ),
      fallbackTransition("training_module_3_healthy_eating"),

      exactTransition(
        "training_module_3_audio",
        "continuemos",
        "training_module_3_minutario",
        1,
      ),
      fallbackTransition("training_module_3_audio"),

      exactTransition(
        "training_module_3_minutario",
        "vamos",
        "training_module_3_menu_video",
        1,
      ),
      fallbackTransition("training_module_3_minutario"),

      exactTransition(
        "training_module_3_menu_video",
        "continuar",
        "training_module_4_intro",
        1,
      ),
      exactTransition(
        "training_module_3_menu_video",
        "continuemos",
        "training_module_4_intro",
        2,
      ),
      fallbackTransition("training_module_3_menu_video"),

      exactTransition(
        "training_module_4_intro",
        "continuar",
        "training_module_4_survey_intro",
        1,
      ),
      fallbackTransition("training_module_4_intro"),

      exactTransition(
        "training_module_4_survey_intro",
        "vamos",
        "training_module_4_survey_q1",
        1,
      ),
      exactTransition(
        "training_module_4_survey_intro",
        "continuar",
        "training_module_4_survey_q1",
        2,
      ),
      fallbackTransition("training_module_4_survey_intro"),

      exactTransition(
        "training_module_4_survey_q1",
        "1",
        "training_module_4_survey_q2",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q1",
        "2",
        "training_module_4_survey_q2",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q1",
        "3",
        "training_module_4_survey_q2",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q1",
        "4",
        "training_module_4_survey_q2",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q1",
        "5",
        "training_module_4_survey_q2",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q1"),

      exactTransition(
        "training_module_4_survey_q2",
        "1",
        "training_module_4_survey_q3",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q2",
        "2",
        "training_module_4_survey_q3",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q2",
        "3",
        "training_module_4_survey_q3",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q2",
        "4",
        "training_module_4_survey_q3",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q2",
        "5",
        "training_module_4_survey_q3",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q2"),

      exactTransition(
        "training_module_4_survey_q3",
        "1",
        "training_module_4_survey_q4",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q3",
        "2",
        "training_module_4_survey_q4",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q3",
        "3",
        "training_module_4_survey_q4",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q3",
        "4",
        "training_module_4_survey_q4",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q3",
        "5",
        "training_module_4_survey_q4",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q3"),

      exactTransition(
        "training_module_4_survey_q4",
        "1",
        "training_module_4_survey_q5",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q4",
        "2",
        "training_module_4_survey_q5",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q4",
        "3",
        "training_module_4_survey_q5",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q4",
        "4",
        "training_module_4_survey_q5",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q4",
        "5",
        "training_module_4_survey_q5",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q4"),

      exactTransition(
        "training_module_4_survey_q5",
        "1",
        "training_module_4_survey_q6",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q5",
        "2",
        "training_module_4_survey_q6",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q5",
        "3",
        "training_module_4_survey_q6",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q5",
        "4",
        "training_module_4_survey_q6",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q5",
        "5",
        "training_module_4_survey_q6",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q5"),

      exactTransition(
        "training_module_4_survey_q6",
        "1",
        "training_module_4_completion",
        1,
        "1",
      ),
      exactTransition(
        "training_module_4_survey_q6",
        "2",
        "training_module_4_completion",
        2,
        "2",
      ),
      exactTransition(
        "training_module_4_survey_q6",
        "3",
        "training_module_4_completion",
        3,
        "3",
      ),
      exactTransition(
        "training_module_4_survey_q6",
        "4",
        "training_module_4_completion",
        4,
        "4",
      ),
      exactTransition(
        "training_module_4_survey_q6",
        "5",
        "training_module_4_completion",
        5,
        "5",
      ),
      fallbackTransition("training_module_4_survey_q6"),
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
    title: "Bienvenida y arranque",
    summary:
      "Onboarding inicial, instrucciones del chat y preparacion para comenzar la capacitacion.",
    stepKeys: ["training_welcome_intro", "training_materials_intro"],
  },
  {
    slug: "modulo-1",
    title: "Modulo 1 - Verificacion de condiciones",
    summary:
      "Conceptos base, higiene, limpieza, contaminacion y evaluacion del modulo 1.",
    stepKeys: [
      "training_module_1_intro",
      "training_cafeteria_experience",
      "training_eta_audio",
      "training_eta_activity",
      "training_food_handling_audio",
      "training_regulation_intro",
      "training_hygiene_summary",
      "training_cleaning_audio",
      "training_drying_video",
      "training_drying_quiz",
      "training_drying_quiz_correct",
      "training_drying_quiz_incorrect",
      "training_cross_contamination_audio",
      "training_temperature_control",
      "training_evaluation_intro",
      "training_evaluation_q1",
      "training_evaluation_q2",
      "training_evaluation_q3",
      "training_evaluation_q4",
      "training_evaluation_q5",
      "training_evaluation_q6",
      "training_evaluation_result",
    ],
  },
  {
    slug: "modulo-2",
    title: "Modulo 2 - Practicas higienicas",
    summary:
      "Higiene personal, lavado de manos, residuos, PEPS, almacenamiento y control de plagas.",
    stepKeys: [
      "training_module_2_intro",
      "training_module_2_rules_video",
      "training_module_2_quiz_intro",
      "training_module_2_q1",
      "training_module_2_q2",
      "training_module_2_q3",
      "training_module_2_q4",
      "training_module_2_q5",
      "training_module_2_q6",
      "training_module_2_q7",
      "training_module_2_q8",
      "training_module_2_quiz_result",
      "training_module_2_handwashing_video",
      "training_module_2_handwashing_quiz",
      "training_module_2_waste_infographic",
      "training_module_2_peps_audio",
      "training_module_2_storage_video",
      "training_module_2_pests_infographic",
      "training_module_2_fruit_wash_infographic",
    ],
  },
  {
    slug: "modulo-3",
    title: "Modulo 3 - Preparacion de alimentos y bebidas",
    summary:
      "Etiquetado, manual oficial, alimentacion saludable, preparacion de alimentos y menus.",
    stepKeys: [
      "training_module_3_intro",
      "training_module_3_manual",
      "training_module_3_healthy_eating",
      "training_module_3_audio",
      "training_module_3_minutario",
      "training_module_3_menu_video",
    ],
  },
  {
    slug: "modulo-4",
    title: "Modulo 4 - Atencion a la comunidad escolar",
    summary:
      "Cierre de la capacitacion, oferta alimentaria y encuesta final de satisfaccion.",
    stepKeys: [
      "training_module_4_intro",
      "training_module_4_survey_intro",
      "training_module_4_survey_q1",
      "training_module_4_survey_q2",
      "training_module_4_survey_q3",
      "training_module_4_survey_q4",
      "training_module_4_survey_q5",
      "training_module_4_survey_q6",
      "training_module_4_completion",
    ],
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
  const templateByKey = new Map(
    templates.map((template) => [template.key, template]),
  );
  const welcomeFlow = flowDefinitions.find((flow) => flow.key === "welcome");

  if (!welcomeFlow) {
    throw new Error(
      "The welcome flow definition is required to seed the Nutri course.",
    );
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

  const sampleContact = await prisma.contact.upsert({
    where: { phone: "+5212462062041" },
    create: {
      phone: "+5212462062041",
      name: "Estudiante Nutri",
      profileName: "Estudiante Nutri",
      locale: "es-MX",
      isOptedIn: true,
    },
    update: {
      name: "Estudiante Nutri",
      profileName: "Estudiante Nutri",
      locale: "es-MX",
      isOptedIn: true,
    },
  });

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
      url: "public://training-assets/modulo-1-conceptos-basicos.png",
      pathname: "/training-assets/modulo-1-conceptos-basicos.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-1-eta-infografia.png",
      pathname: "/training-assets/modulo-1-eta-infografia.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-2-residuos-solidos.png",
      pathname: "/training-assets/modulo-2-residuos-solidos.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-2-control-plagas.png",
      pathname: "/training-assets/modulo-2-control-plagas.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-2-lavado-frutas-verduras.png",
      pathname: "/training-assets/modulo-2-lavado-frutas-verduras.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-3-etiquetado-alimentos.png",
      pathname: "/training-assets/modulo-3-etiquetado-alimentos.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-3-alimentacion-saludable.png",
      pathname: "/training-assets/modulo-3-alimentacion-saludable.png",
      kind: "IMAGE" as const,
      contentType: "image/png",
    },
    {
      url: "public://training-assets/modulo-4-oferta-alimentaria.png",
      pathname: "/training-assets/modulo-4-oferta-alimentaria.png",
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
          where: {
            url: `public:${introAssetPath}`.replace("public:/", "public://"),
          },
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
        displayLabel: getTransitionDisplayLabel(
          transition.pattern,
          transition.outputValue,
        ),
        displayHint: getTransitionDisplayHint(
          transition.pattern,
          transition.outputValue,
        ),
        outputValue: transition.outputValue ?? null,
        priority: transition.priority,
        isActive: true,
      },
    });
  }

  await prisma.contactAccessCredential.upsert({
    where: {
      contactId: sampleContact.id,
    },
    create: {
      contactId: sampleContact.id,
      secretHash: await hash("NUTRI2026", 10),
      isActive: true,
      failedAttempts: 0,
    },
    update: {
      secretHash: await hash("NUTRI2026", 10),
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
      lastVerifiedAt: null,
    },
  });

  await prisma.courseEnrollment.upsert({
    where: {
      contactId_courseId: {
        contactId: sampleContact.id,
        courseId: course.id,
      },
    },
    create: {
      contactId: sampleContact.id,
      courseId: course.id,
      isActive: true,
    },
    update: {
      isActive: true,
      completedAt: null,
    },
  });
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
