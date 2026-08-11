-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "perceivedEffort" INTEGER,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ALTER COLUMN "stravaId" DROP NOT NULL;
