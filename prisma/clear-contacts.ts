/**
 * Destructive database helper: remove every contact and contact-owned runtime record.
 *
 * Usage:
 *   npm run db:clear-contacts -- --confirm
 *
 * This keeps authoring/admin data intact: courses, modules, steps, transitions,
 * assets, admins, and templates are not deleted.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to clear contacts.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function assertExplicitConfirmation() {
  const hasConfirmFlag = process.argv.includes("--confirm");
  const hasConfirmEnv = process.env.CONFIRM_CLEAR_CONTACTS === "true";

  if (!hasConfirmFlag && !hasConfirmEnv) {
    throw new Error(
      [
        "Refusing to clear contacts without explicit confirmation.",
        "Run: npm run db:clear-contacts -- --confirm",
        "Or set: CONFIRM_CLEAR_CONTACTS=true",
      ].join("\n"),
    );
  }
}

async function main() {
  assertExplicitConfirmation();

  const [
    courseSurveySubmissions,
    messages,
    conversations,
    courseEnrollments,
    contactAccessCredentials,
    contacts,
  ] = await prisma.$transaction([
    prisma.courseSurveySubmission.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.courseEnrollment.deleteMany(),
    prisma.contactAccessCredential.deleteMany(),
    prisma.contact.deleteMany(),
  ]);

  console.log("Contacts table cleanup completed.");
  console.table({
    courseSurveySubmissions: courseSurveySubmissions.count,
    messages: messages.count,
    conversations: conversations.count,
    courseEnrollments: courseEnrollments.count,
    contactAccessCredentials: contactAccessCredentials.count,
    contacts: contacts.count,
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
