/*
  Warnings:

  - You are about to drop the column `comprehensionScore` on the `UserStats` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswers` on the `UserStats` table. All the data in the column will be lost.
  - You are about to drop the column `totalQuestions` on the `UserStats` table. All the data in the column will be lost.

*/
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserStats" ("clerkUserId", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalExercisesCompleted", "totalPassagesRead", "totalReadingTime", "updatedAt") SELECT "clerkUserId", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalExercisesCompleted", "totalPassagesRead", "totalReadingTime", "updatedAt" FROM "UserStats";
DROP TABLE "UserStats";
ALTER TABLE "new_UserStats" RENAME TO "UserStats";
CREATE UNIQUE INDEX "UserStats_clerkUserId_key" ON "UserStats"("clerkUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
