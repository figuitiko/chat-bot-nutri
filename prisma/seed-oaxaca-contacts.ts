/**
 * Seed: Oaxaca contacts batch
 * Keyword: OAXACA — linked to nutri course
 * Source: Lista para ChatBot.docx
 *
 * NOTE: "Sonia García Ojendiz" and "Sonia Sánchez García" share phone 9581197204.
 * The second upsert wins — Sonia Sánchez García will be the stored name.
 * NOTE: "Verónica Leticia López Antonio" has 9 digits (951365277) — may be incomplete.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hash } from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const SECRET = "OAXACA";
const COURSE_SLUG = "nutri";

const RAW_CONTACTS: Array<{ name: string; phone: string }> = [
  { name: "Juana Molina Luis", phone: "9721077919" },
  { name: "Blanca Magdalena Herrera Juarez", phone: "9535417077" },
  { name: "Cristina Ramos Hernández", phone: "9512572567" },
  { name: "Ari Avendaño Orozco", phone: "9511566426" },
  { name: "Janely del Carmen Sánchez Monterrosa", phone: "9512226308" },
  { name: "Ascensión Emilia Mayren Velázquez", phone: "9541603477" },
  { name: "Antonio Abad Hernández Ángel", phone: "9513942009" },
  { name: "Alejandrino Reyes Vásquez", phone: "9512278547" },
  { name: "Lucila Baños Mendoza", phone: "9541847440" },
  { name: "Margarita Ruiz Ramírez", phone: "9541196945" },
  { name: "Gloria Hildegardia Ruíz Mendoza", phone: "9541271418" },
  { name: "Angélica Reyes Vásquez", phone: "9513038687" },
  { name: "Rafael Chávez Salvador", phone: "9535370547" },
  { name: "María del Carmen Villar Peguero", phone: "2871017650" },
  { name: "Betsy Yasaratte González Hernández", phone: "2871245312" },
  { name: "Celsa Cruz Cortez", phone: "6242282162" },
  { name: "Edra Patricia Poblete Díaz", phone: "9512351162" },
  { name: "Alba Rosa Díaz Laredo", phone: "9513224133" },
  { name: "María del Carmen Nicolás", phone: "9531125984" },
  { name: "Eleuteria Vásquez García", phone: "9512573411" },
  { name: "Ana María López Méndez", phone: "9541205505" },
  { name: "Amanda Midelvia Ramírez Hernández", phone: "9541272811" },
  { name: "Juana Reyna Ruiz Ortiz", phone: "9541504975" },
  { name: "Marino Juárez", phone: "2871013887" },
  { name: "Sonia García Ojendiz", phone: "9581197204" },
  { name: "Elizabeth Reyna Cabanzo Miranda", phone: "2361160948" },
  { name: "Sonia Sánchez García", phone: "9581197204" }, // duplicate phone — this name wins
  { name: "Jesús Ernesto Vinzha S.", phone: "5522134172" },
  { name: "Angelica García Vásquez", phone: "9512414261" },
  { name: "Abigail Mendoza Jiménez", phone: "9512175813" },
  { name: "Flor Catalina González López", phone: "9515812622" },
  { name: "Alejandra Griselda García Hernández", phone: "2361227684" },
  { name: "Belquis Elisabeth Moreno Madrid", phone: "9711858313" },
  { name: "Julia Yesenia García José", phone: "9581183307" },
  { name: "Liliana Valdez Belmonte", phone: "9615916270" },
  { name: "Isabel Gutiérrez Jiménez", phone: "9711173789" },
  { name: "Gilberto Castro Sabino", phone: "2871044775" },
  { name: "Irma Sandra Contreras Caballero", phone: "9514216579" },
  { name: "Antonio Molina Toledo", phone: "9721160080" },
  { name: "Cristina Inés Pérez Flores", phone: "9514982561" },
  { name: "Noemi García Pérez", phone: "9511427414" },
  { name: "Julia Itzel Sosa", phone: "9512588219" },
  { name: "Ana Bertha Quintero Roque", phone: "2872855236" },
  { name: "Ernesta Vásquez Ruiz", phone: "9513575863" },
  { name: "Victoria Velasco Guerrero", phone: "2871527800" },
  { name: "Celeste Cecilia Barón Méndez", phone: "9514321643" },
  { name: "Kenia Marian Martínez Bautista", phone: "9513812739" },
  { name: "Lidoyne Bonniet Sánchez Morga", phone: "9511807802" },
  { name: "Virginia Díaz Ruíz", phone: "9514179153" },
  { name: "Diasmin Areli Pérez García", phone: "9511365384" },
  { name: "Jovita Santiago Hernández", phone: "9541583757" },
  { name: "Cristina Rosales Martínez", phone: "9543123059" },
  { name: "Alejandra Gómez Flores", phone: "9518424992" },
  { name: "Ofelia García López", phone: "2871446113" },
  { name: "Jessica Micheli Núñez Gómez", phone: "9512977559" },
  { name: "Rosa Elva Lobo Osorio", phone: "9712060068" },
  { name: "Víctor Hugo Sánchez Bautista", phone: "9531314595" },
  { name: "Aurelia Fachada Cruz", phone: "9512652065" },
  { name: "Natividad Altamirano García", phone: "9512542055" },
  { name: "Guadalupe del Carmen Santiago Padilla", phone: "9545888847" },
  { name: "Marilú López Fuentes", phone: "9721309119" },
  { name: "Juan Leonel Osorio Cortes", phone: "9514785469" },
  { name: "Teodula Ramírez García", phone: "9541393993" },
  { name: "María Francisca", phone: "9511785456" },
  { name: "Gabriela Elizabeth Sánchez Luna", phone: "9511606884" },
  { name: "Tomasa Morales José", phone: "9711143919" },
  { name: "Julissa Fuentes Matus", phone: "9941064241" },
  { name: "Estefanía Vásquez Luis", phone: "9511074640" },
  { name: "Elena Blanquita Aguilar García", phone: "9515860089" },
  { name: "Patricia Merced Lázaro Cuevas", phone: "9941022271" },
  { name: "Teresa Santiago Bautista", phone: "9531950604" },
  { name: "Elsa García López", phone: "9541039744" },
  { name: "Karen Soledad Esperanza Díaz", phone: "9513509504" },
  { name: "Erica García López", phone: "9511990855" },
  { name: "Judith Leonila García Hernández", phone: "9541130650" },
  { name: "Hernández Tamayo Gabriela", phone: "9535407926" },
  { name: "Margarita Méndez Bautista", phone: "9512330856" },
  { name: "Eva Minerva Juárez Gómez", phone: "9518751026" },
  { name: "Hilda Sobeida Hernández", phone: "9531108815" },
  { name: "Irma Salgado Castillo", phone: "2741017335" },
  { name: "Macaria Damián Bautista", phone: "2202541259" },
  { name: "Viridiana Alondra Rueda Barrita", phone: "2741006011" },
  { name: "Ana Cristina García", phone: "9518820104" },
  { name: "Víctor Beltrán Cabrera", phone: "2741146171" },
  { name: "Eufracia Vásquez", phone: "9511830062" },
  { name: "Elizabeth García Ángeles", phone: "9516662786" },
  { name: "María del Rosario López Hernández", phone: "9513319716" },
  { name: "Teresa Cristina Santiago López", phone: "9512904730" },
  { name: "Azalia Mora Sáenz", phone: "2741210694" },
  { name: "Leticia Velasco Cruz", phone: "9531377061" },
  { name: "Ana Laura Morales Ramírez", phone: "9512697025" },
  { name: "Esperanza Maldonado Centeno", phone: "2221180047" },
  { name: "Abel Martínez Ramírez", phone: "9512425020" },
  { name: "Damiana Angelica Santiago López", phone: "9513487995" },
  { name: "Francisco Javier Jiménez Manzano", phone: "9511008202" },
  { name: "Adriana Ramírez Cruz", phone: "9535384580" },
  { name: "Alfonso Hernández López", phone: "9241969309" },
  { name: "Celida Reyna Ordoñez", phone: "9711172160" },
];

function normalizePhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  return `+52${clean}`;
}

async function main() {
  const course = await prisma.course.findUniqueOrThrow({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });

  const secretHash = await hash(SECRET, 10);
  let created = 0;
  let updated = 0;

  for (const raw of RAW_CONTACTS) {
    const phone = normalizePhone(raw.phone);

    const contact = await prisma.contact.upsert({
      where: { phone },
      create: { phone, name: raw.name },
      update: { name: raw.name },
      select: { id: true, phone: true },
    });

    const wasNew = !contact;
    created += wasNew ? 1 : 0;
    updated += wasNew ? 0 : 1;

    await prisma.contactAccessCredential.upsert({
      where: { contactId: contact.id },
      create: {
        contactId: contact.id,
        secretHash,
        isActive: true,
        failedAttempts: 0,
      },
      update: {
        secretHash,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
        lastVerifiedAt: null,
      },
    });

    await prisma.courseEnrollment.upsert({
      where: {
        contactId_courseId: {
          contactId: contact.id,
          courseId: course.id,
        },
      },
      create: {
        contactId: contact.id,
        courseId: course.id,
        isActive: true,
      },
      update: {
        isActive: true,
        completedAt: null,
      },
    });

    console.log(`✓ ${raw.name} (${phone})`);
  }

  console.log(`\nDone: ${RAW_CONTACTS.length} contacts processed for course "${COURSE_SLUG}" with secret "${SECRET}".`);
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
