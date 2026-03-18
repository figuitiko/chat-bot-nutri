-- CreateEnum
CREATE TYPE "TemplateDeliveryMode" AS ENUM ('STANDARD', 'MEDIA_FIRST');

-- AlterTable
ALTER TABLE "MessageTemplate"
ADD COLUMN "deliveryMode" "TemplateDeliveryMode" NOT NULL DEFAULT 'STANDARD';
