-- CreateTable
CREATE TABLE "CourseSurveySubmission" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answers" JSONB NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseSurveySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseSurveySubmission_conversationId_key" ON "CourseSurveySubmission"("conversationId");

-- CreateIndex
CREATE INDEX "CourseSurveySubmission_courseId_submittedAt_idx" ON "CourseSurveySubmission"("courseId", "submittedAt");

-- CreateIndex
CREATE INDEX "CourseSurveySubmission_contactId_submittedAt_idx" ON "CourseSurveySubmission"("contactId", "submittedAt");

-- AddForeignKey
ALTER TABLE "CourseSurveySubmission" ADD CONSTRAINT "CourseSurveySubmission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSurveySubmission" ADD CONSTRAINT "CourseSurveySubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSurveySubmission" ADD CONSTRAINT "CourseSurveySubmission_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
