-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "DailyMetrics" DROP CONSTRAINT "DailyMetrics_userId_fkey";

-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_userId_fkey";

-- DropForeignKey
ALTER TABLE "PendingReview" DROP CONSTRAINT "PendingReview_userId_fkey";

-- DropForeignKey
ALTER TABLE "PlannedWorkout" DROP CONSTRAINT "PlannedWorkout_userId_fkey";

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_userId_fkey";

-- DropForeignKey
ALTER TABLE "StravaAuth" DROP CONSTRAINT "StravaAuth_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "WeekFocus" DROP CONSTRAINT "WeekFocus_userId_fkey";

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ChatMessage" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "DailyMetrics" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PendingReview" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "PlannedWorkout" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Recommendation" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StravaAuth" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserProfile" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "WeekFocus" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekFocus" ADD CONSTRAINT "WeekFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMetrics" ADD CONSTRAINT "DailyMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StravaAuth" ADD CONSTRAINT "StravaAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingReview" ADD CONSTRAINT "PendingReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
