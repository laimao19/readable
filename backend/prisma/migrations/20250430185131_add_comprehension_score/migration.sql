-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minutesRead" INTEGER NOT NULL,
    "passagesRead" INTEGER NOT NULL,
    "difficultWords" TEXT NOT NULL,
    "difficultWordPercentage" REAL NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "comprehensionScore" REAL NOT NULL DEFAULT 0,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_clerkUserId_fkey" FOREIGN KEY ("clerkUserId") REFERENCES "UserStats" ("clerkUserId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Exercise" ("clerkUserId", "completedAt", "createdAt", "difficultWordPercentage", "difficultWords", "id", "minutesRead", "passagesRead", "totalWords", "type") SELECT "clerkUserId", "completedAt", "createdAt", "difficultWordPercentage", "difficultWords", "id", "minutesRead", "passagesRead", "totalWords", "type" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE TABLE "new_UserStats" (
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
    "comprehensionScore" REAL NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSessionDuration" INTEGER NOT NULL DEFAULT 0,
    "lastDifficultWordPercentage" REAL NOT NULL DEFAULT 0,
    "dailyGoal" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_UserStats" ("clerkUserId", "correctAnswers", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalExercisesCompleted", "totalPassagesRead", "totalQuestions", "totalReadingTime", "updatedAt") SELECT "clerkUserId", "correctAnswers", "createdAt", "dailyGoal", "id", "lastActivity", "lastDifficultWordPercentage", "lastSessionDuration", "progress", "readingLevel", "startDate", "streak", "totalExercisesCompleted", "totalPassagesRead", "totalQuestions", "totalReadingTime", "updatedAt" FROM "UserStats";
DROP TABLE "UserStats";
ALTER TABLE "new_UserStats" RENAME TO "UserStats";
CREATE UNIQUE INDEX "UserStats_clerkUserId_key" ON "UserStats"("clerkUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
