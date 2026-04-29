/**
 * Fix Mexican phone numbers missing the `1` after country code 52.
 * Wrong:   +529513183211  (52 + 10-digit local)
 * Correct: +5219513183211 (52 + 1 + 10-digit local)
 *
 * If the corrected phone already exists → merge: migrate relations to the
 * existing contact, then delete the duplicate.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function needsFix(phone: string): boolean {
  // Matches +52 followed by anything other than '1'
  return /^\+52[^1]/.test(phone);
}

function fixPhone(phone: string): string {
  // Insert '1' after '+52'
  return "+521" + phone.slice(3);
}

async function mergeContacts(sourceId: string, targetId: string) {
  // --- conversations ---
  // Unique constraints: [contactId, flowId] and [contactId, courseId]
  const targetConversations = await prisma.conversation.findMany({
    where: { contactId: targetId },
    select: { flowId: true, courseId: true },
  });

  const targetFlowIds = new Set(
    targetConversations.map((c) => c.flowId).filter(Boolean)
  );
  const targetCourseIds = new Set(
    targetConversations.map((c) => c.courseId).filter(Boolean)
  );

  const sourceConversations = await prisma.conversation.findMany({
    where: { contactId: sourceId },
    select: { id: true, flowId: true, courseId: true },
  });

  for (const conv of sourceConversations) {
    const conflictsFlow = conv.flowId && targetFlowIds.has(conv.flowId);
    const conflictsCourse =
      conv.courseId && targetCourseIds.has(conv.courseId);

    if (conflictsFlow || conflictsCourse) {
      // Target already has this conversation — discard source's
      await prisma.conversation.delete({ where: { id: conv.id } });
    } else {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { contactId: targetId },
      });
    }
  }

  // --- enrollments ---
  // Unique constraint: [contactId, courseId]
  const targetEnrollments = await prisma.courseEnrollment.findMany({
    where: { contactId: targetId },
    select: { courseId: true },
  });
  const targetEnrolledCourseIds = new Set(
    targetEnrollments.map((e) => e.courseId)
  );

  const sourceEnrollments = await prisma.courseEnrollment.findMany({
    where: { contactId: sourceId },
    select: { id: true, courseId: true },
  });

  for (const enrollment of sourceEnrollments) {
    if (targetEnrolledCourseIds.has(enrollment.courseId)) {
      await prisma.courseEnrollment.delete({ where: { id: enrollment.id } });
    } else {
      await prisma.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { contactId: targetId },
      });
    }
  }

  // --- messages --- (no unique constraint, move all)
  await prisma.message.updateMany({
    where: { contactId: sourceId },
    data: { contactId: targetId },
  });

  // --- surveySubmissions --- (no unique constraint, move all)
  await prisma.courseSurveySubmission.updateMany({
    where: { contactId: sourceId },
    data: { contactId: targetId },
  });

  // --- accessCredential --- (unique on contactId)
  const targetCred = await prisma.contactAccessCredential.findUnique({
    where: { contactId: targetId },
  });
  const sourceCred = await prisma.contactAccessCredential.findUnique({
    where: { contactId: sourceId },
  });

  if (!targetCred && sourceCred) {
    // Transfer source credential to target
    await prisma.contactAccessCredential.update({
      where: { contactId: sourceId },
      data: { contactId: targetId },
    });
  }
  // If target already has credential → cascade delete handles source's on contact delete

  // Delete source contact (cascade cleans up remaining relations)
  await prisma.contact.delete({ where: { id: sourceId } });
}

async function main() {
  const allContacts = await prisma.contact.findMany({
    select: { id: true, phone: true, waId: true, name: true },
  });

  const toFix = allContacts.filter((c) => needsFix(c.phone));

  if (toFix.length === 0) {
    console.log("No contacts need fixing.");
    return;
  }

  console.log(`Found ${toFix.length} contact(s) to fix:\n`);

  for (const contact of toFix) {
    const fixed = fixPhone(contact.phone);
    console.log(`  ${contact.phone} → ${fixed}  (${contact.name ?? "unnamed"})`);

    const existing = await prisma.contact.findUnique({
      where: { phone: fixed },
    });

    if (existing) {
      console.log(
        `    ⚠ Duplicate found (${existing.name ?? "unnamed"}). Merging into existing contact.`
      );
      await mergeContacts(contact.id, existing.id);
      console.log(`    ✓ Merged and deleted duplicate.`);
    } else {
      // Simple update — also fix waId if it carries the same pattern
      const fixedWaId =
        contact.waId && needsFix(contact.waId)
          ? fixPhone(contact.waId)
          : contact.waId;

      await prisma.contact.update({
        where: { id: contact.id },
        data: { phone: fixed, waId: fixedWaId ?? undefined },
      });
      console.log(`    ✓ Updated.`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
