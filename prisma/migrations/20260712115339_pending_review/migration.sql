-- CreateTable
CREATE TABLE "PendingReview" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "planAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "weeklyRecommendation" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingReview_pkey" PRIMARY KEY ("id")
);
