-- CreateTable
CREATE TABLE "UserStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "readingLevel" TEXT NOT NULL DEFAULT 'intermediate',
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" DATETIME,
    "totalReadingTime" INTEGER NOT NULL DEFAULT 0,
    "totalPassagesRead" INTEGER NOT NULL DEFAULT 0,
    "totalExercisesCompleted" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSessionDuration" INTEGER NOT NULL DEFAULT 0,
    "dailyGoal" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStats_clerkUserId_key" ON "UserStats"("clerkUserId");
