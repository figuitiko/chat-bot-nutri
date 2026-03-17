-- CreateEnum
CREATE TYPE "FlowStepRenderMode" AS ENUM ('TEXT', 'AUTO', 'QUICK_REPLY', 'LIST_PICKER');

-- AlterTable
ALTER TABLE "BotFlowStep" ADD COLUMN "renderMode" "FlowStepRenderMode" NOT NULL DEFAULT 'TEXT';
