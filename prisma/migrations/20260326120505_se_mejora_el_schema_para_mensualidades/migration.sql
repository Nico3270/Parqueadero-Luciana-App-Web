/*
  Warnings:

  - You are about to drop the column `isActive` on the `Subscription` table. All the data in the column will be lost.
  - Made the column `customerId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELED');

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_customerId_fkey";

-- DropIndex
DROP INDEX "Subscription_isActive_endAt_idx";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "phoneSecondary" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "isActive",
ADD COLUMN     "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "customerId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Customer_phoneSecondary_idx" ON "Customer"("phoneSecondary");

-- CreateIndex
CREATE INDEX "ParkingSession_vehicleId_entryAt_idx" ON "ParkingSession"("vehicleId", "entryAt");

-- CreateIndex
CREATE INDEX "Subscription_status_endAt_idx" ON "Subscription"("status", "endAt");

-- CreateIndex
CREATE INDEX "Subscription_startAt_endAt_idx" ON "Subscription"("startAt", "endAt");

-- CreateIndex
CREATE INDEX "Subscription_vehicleId_status_endAt_idx" ON "Subscription"("vehicleId", "status", "endAt");

-- CreateIndex
CREATE INDEX "Subscription_customerId_status_endAt_idx" ON "Subscription"("customerId", "status", "endAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
