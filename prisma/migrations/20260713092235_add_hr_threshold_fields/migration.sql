-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "maxHr" INTEGER,
ADD COLUMN     "restingHr" INTEGER,
ADD COLUMN     "thresholdMethod" TEXT NOT NULL DEFAULT 'riegel';
