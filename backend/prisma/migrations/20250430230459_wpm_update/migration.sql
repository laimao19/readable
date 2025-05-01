-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "readingTimeSeconds" REAL;
ALTER TABLE "Exercise" ADD COLUMN "wordsPerMinute" INTEGER;

-- CreateTable
CREATE TABLE "ReadingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "exerciseType" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingTimeSeconds" REAL,
    "wordsPerMinute" INTEGER,
    "inProgress" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingSession_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "UserStats" ("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "readingLevel" TEXT NOT NULL DEFAULT 'intermediate',
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" DATETIME,
    "totalReadingTime" INTEGER NOT NULL DEFAULT 0,
    "totalPassagesRead" INTEGER NOT NULL DEFAULT 0,
    "totalExercisesCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalCorrectComprehensionAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalComprehensionQuestions" INTEGER NOT NULL DEFAULT 0,
    "averageComprehensionScore" REAL NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSessionDuration" INTEGER NOT NULL DEFAULT 0,
    "lastDifficultWordPercentage" REAL NOT NULL DEFAULT 0,
    "dailyGoal" INTEGER NOT NULL DEFAULT 15,
    "averageWPM" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserStats" ("averageComprehensionScore", "clerkUserId", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalComprehensionQuestions", "totalCorrectComprehensionAnswers", "totalExercisesCompleted", "totalPassagesRead", "totalReadingTime", "updatedAt") SELECT "averageComprehensionScore", "clerkUserId", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalComprehensionQuestions", "totalCorrectComprehensionAnswers", "totalExercisesCompleted", "totalPassagesRead", "totalReadingTime", "updatedAt" FROM "UserStats";
DROP TABLE "UserStats";
ALTER TABLE "new_UserStats" RENAME TO "UserStats";
CREATE UNIQUE INDEX "UserStats_clerkUserId_key" ON "UserStats"("clerkUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReadingSession_clerkUserId_exerciseType_key" ON "ReadingSession"("clerkUserId", "exerciseType");
