-- CreateEnum
CREATE TYPE "WorkoutType" AS ENUM ('EASY_RUN', 'TEMPO_RUN', 'INTERVALS', 'LONG_RUN', 'RACE', 'STRENGTH', 'HIIT', 'MTB', 'CYCLING', 'SWIM', 'MOBILITY', 'REST', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkoutSource" AS ENUM ('USER', 'AI_GENERATED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "stravaId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "avgHr" INTEGER,
    "avgPace" DOUBLE PRECISION,
    "elevation" DOUBLE PRECISION,
    "splits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "WorkoutType" NOT NULL,
    "targetDistance" DOUBLE PRECISION,
    "targetDuration" INTEGER,
    "description" TEXT NOT NULL,
    "goalId" TEXT,
    "completedActivityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" "WorkoutSource" NOT NULL DEFAULT 'USER',
    "originalDate" TIMESTAMP(3),
    "adjustmentReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "targetMetric" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMetrics" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ctl" DOUBLE PRECISION,
    "atl" DOUBLE PRECISION,
    "tsb" DOUBLE PRECISION,
    "acwr" DOUBLE PRECISION,
    "monotony" DOUBLE PRECISION,
    "strain" DOUBLE PRECISION,
    "hrv" DOUBLE PRECISION,
    "restingHr" INTEGER,
    "sleepScore" DOUBLE PRECISION,
    "bodyBattery" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaAuth" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "experienceLevel" TEXT,
    "injuryHistory" TEXT,
    "preferredTrainingDays" JSONB,
    "maxWeeklyHours" DOUBLE PRECISION,
    "crossTrainingPrefs" JSONB,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_stravaId_key" ON "Activity"("stravaId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedWorkout_completedActivityId_key" ON "PlannedWorkout"("completedActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetrics_date_key" ON "DailyMetrics"("date");

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_completedActivityId_fkey" FOREIGN KEY ("completedActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
