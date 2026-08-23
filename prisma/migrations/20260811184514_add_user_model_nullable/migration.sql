-- DropIndex
DROP INDEX "Activity_stravaId_key";

-- DropIndex
DROP INDEX "DailyMetrics_date_key";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "DailyMetrics" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Goal" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "PendingReview" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlannedWorkout" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "StravaAuth" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WeekFocus" DROP CONSTRAINT "WeekFocus_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT,
ADD CONSTRAINT "WeekFocus_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_stravaId_key" ON "Activity"("userId", "stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetrics_userId_date_key" ON "DailyMetrics"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PendingReview_userId_key" ON "PendingReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaAuth_userId_key" ON "StravaAuth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekFocus_userId_weekStart_key" ON "WeekFocus"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekFocus" ADD CONSTRAINT "WeekFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetrics" ADD CONSTRAINT "DailyMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StravaAuth" ADD CONSTRAINT "StravaAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingReview" ADD CONSTRAINT "PendingReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

