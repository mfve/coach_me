-- CreateTable
CREATE TABLE "WeekFocus" (
    "weekStart" TIMESTAMP(3) NOT NULL,
    "focus" TEXT NOT NULL,
    "goalId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekFocus_pkey" PRIMARY KEY ("weekStart")
);
