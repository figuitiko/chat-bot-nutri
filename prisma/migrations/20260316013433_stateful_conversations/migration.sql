-- CreateEnum
CREATE TYPE "FlowStepInputType" AS ENUM ('CHOICE', 'FREE_TEXT');

-- AlterTable
ALTER TABLE "BotFlow" ADD COLUMN     "entryStepKey" TEXT;

-- AlterTable
ALTER TABLE "BotRule" ADD COLUMN     "targetFlowKey" TEXT,
ALTER COLUMN "responseTemplateKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "contextData" JSONB,
ADD COLUMN     "currentStepId" TEXT;

-- CreateTable
CREATE TABLE "BotFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "inputType" "FlowStepInputType" NOT NULL DEFAULT 'CHOICE',
    "captureKey" TEXT,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotFlowTransition" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "nextStepId" TEXT,
    "matchType" "BotRuleMatchType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "outputValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotFlowStep_flowId_idx" ON "BotFlowStep"("flowId");

-- CreateIndex
CREATE UNIQUE INDEX "BotFlowStep_flowId_key_key" ON "BotFlowStep"("flowId", "key");

-- CreateIndex
CREATE INDEX "BotFlowTransition_stepId_priority_idx" ON "BotFlowTransition"("stepId", "priority");

-- AddForeignKey
ALTER TABLE "BotFlowStep" ADD CONSTRAINT "BotFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BotFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlowTransition" ADD CONSTRAINT "BotFlowTransition_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BotFlowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotFlowTransition" ADD CONSTRAINT "BotFlowTransition_nextStepId_fkey" FOREIGN KEY ("nextStepId") REFERENCES "BotFlowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "BotFlowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
