/*
  Warnings:

  - A unique constraint covering the columns `[scanCode]` on the table `ParkingSession` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scanCode` to the `ParkingSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ParkingSession" ADD COLUMN     "scanCode" VARCHAR(16) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSession_scanCode_key" ON "ParkingSession"("scanCode");

-- CreateIndex
CREATE INDEX "ParkingSession_scanCode_idx" ON "ParkingSession"("scanCode");
