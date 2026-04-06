-- CreateTable
CREATE TABLE "ContactAccessCredential" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactAccessCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "selectedCourseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContactAccessCredential_contactId_key" ON "ContactAccessCredential"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_contactId_courseId_key" ON "CourseEnrollment"("contactId", "courseId");

-- CreateIndex
CREATE INDEX "CourseEnrollment_contactId_isActive_idx" ON "CourseEnrollment"("contactId", "isActive");

-- CreateIndex
CREATE INDEX "CourseEnrollment_courseId_isActive_idx" ON "CourseEnrollment"("courseId", "isActive");

-- CreateIndex
CREATE INDEX "Conversation_selectedCourseId_idx" ON "Conversation"("selectedCourseId");

-- AddForeignKey
ALTER TABLE "ContactAccessCredential" ADD CONSTRAINT "ContactAccessCredential_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_selectedCourseId_fkey" FOREIGN KEY ("selectedCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
