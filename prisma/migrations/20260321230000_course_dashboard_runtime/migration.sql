-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseStepType" AS ENUM ('CONTENT', 'QUESTION', 'RESULT', 'HANDOFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "coverAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "introAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseStep" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stepType" "CourseStepType" NOT NULL DEFAULT 'CONTENT',
    "sortOrder" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL DEFAULT 'TEXT',
    "deliveryMode" "TemplateDeliveryMode" NOT NULL DEFAULT 'STANDARD',
    "renderMode" "FlowStepRenderMode" NOT NULL DEFAULT 'TEXT',
    "inputType" "FlowStepInputType" NOT NULL DEFAULT 'CHOICE',
    "mediaAssetId" TEXT,
    "mediaUrl" TEXT,
    "captureKey" TEXT,
    "assessmentKey" TEXT,
    "correctAnswer" TEXT,
    "scoreWeight" INTEGER,
    "isAssessmentResult" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTransition" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "nextStepId" TEXT,
    "matchType" "BotRuleMatchType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "displayLabel" TEXT,
    "displayHint" TEXT,
    "outputValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Conversation"
ADD COLUMN "courseId" TEXT,
ADD COLUMN "currentCourseModuleId" TEXT,
ADD COLUMN "currentCourseStepId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_url_key" ON "Asset"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_isActive_idx" ON "Course"("status", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CourseModule_courseId_slug_key" ON "CourseModule"("courseId", "slug");

-- CreateIndex
CREATE INDEX "CourseModule_courseId_sortOrder_idx" ON "CourseModule"("courseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CourseStep_moduleId_slug_key" ON "CourseStep"("moduleId", "slug");

-- CreateIndex
CREATE INDEX "CourseStep_moduleId_sortOrder_idx" ON "CourseStep"("moduleId", "sortOrder");

-- CreateIndex
CREATE INDEX "CourseTransition_stepId_priority_idx" ON "CourseTransition"("stepId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_contactId_courseId_key" ON "Conversation"("contactId", "courseId");

-- CreateIndex
CREATE INDEX "Conversation_courseId_idx" ON "Conversation"("courseId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_coverAssetId_fkey" FOREIGN KEY ("coverAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_introAssetId_fkey" FOREIGN KEY ("introAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseStep" ADD CONSTRAINT "CourseStep_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseStep" ADD CONSTRAINT "CourseStep_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTransition" ADD CONSTRAINT "CourseTransition_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CourseStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTransition" ADD CONSTRAINT "CourseTransition_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "CourseStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentCourseModuleId_fkey" FOREIGN KEY ("currentCourseModuleId") REFERENCES "CourseModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentCourseStepId_fkey" FOREIGN KEY ("currentCourseStepId") REFERENCES "CourseStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
