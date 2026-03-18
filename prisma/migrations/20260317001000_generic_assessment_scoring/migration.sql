-- AlterTable
ALTER TABLE "BotFlowStep"
ADD COLUMN "assessmentKey" TEXT,
ADD COLUMN "correctAnswer" TEXT,
ADD COLUMN "scoreWeight" INTEGER,
ADD COLUMN "isAssessmentResult" BOOLEAN NOT NULL DEFAULT false;
