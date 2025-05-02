-- CreateTable
CREATE TABLE `UserStats` (
    `id` VARCHAR(191) NOT NULL,
    `clerkUserId` VARCHAR(191) NOT NULL,
    `readingLevel` VARCHAR(191) NOT NULL DEFAULT 'intermediate',
    `streak` INTEGER NOT NULL DEFAULT 0,
    `lastActivity` DATETIME(3) NULL,
    `totalReadingTime` INTEGER NOT NULL DEFAULT 0,
    `totalPassagesRead` INTEGER NOT NULL DEFAULT 0,
    `totalExercisesCompleted` INTEGER NOT NULL DEFAULT 0,
    `totalCorrectComprehensionAnswers` INTEGER NOT NULL DEFAULT 0,
    `totalComprehensionQuestions` INTEGER NOT NULL DEFAULT 0,
    `averageComprehensionScore` DOUBLE NOT NULL DEFAULT 0,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSessionDuration` INTEGER NOT NULL DEFAULT 0,
    `lastDifficultWordPercentage` DOUBLE NOT NULL DEFAULT 0,
    `dailyGoal` INTEGER NOT NULL DEFAULT 15,
    `averageWPM` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserStats_clerkUserId_key`(`clerkUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exercise` (
    `id` VARCHAR(191) NOT NULL,
    `clerkUserId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `minutesRead` INTEGER NOT NULL,
    `passagesRead` INTEGER NOT NULL,
    `difficultWords` VARCHAR(191) NOT NULL,
    `difficultWordPercentage` DOUBLE NOT NULL,
    `totalWords` INTEGER NOT NULL,
    `comprehensionScore` DOUBLE NOT NULL DEFAULT 0,
    `readingTimeSeconds` DOUBLE NULL,
    `wordsPerMinute` INTEGER NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiagnosticResult` (
    `id` VARCHAR(191) NOT NULL,
    `clerkUserId` VARCHAR(191) NOT NULL,
    `readingLevel` VARCHAR(191) NOT NULL,
    `accuracyScore` DOUBLE NOT NULL,
    `comprehensionScore` DOUBLE NOT NULL,
    `speedScore` DOUBLE NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReadingSession` (
    `id` VARCHAR(191) NOT NULL,
    `clerkUserId` VARCHAR(191) NOT NULL,
    `exerciseType` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `wordCount` INTEGER NOT NULL DEFAULT 0,
    `readingTimeSeconds` DOUBLE NULL,
    `wordsPerMinute` INTEGER NULL,
    `inProgress` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Exercise` ADD CONSTRAINT `Exercise_clerkUserId_fkey` FOREIGN KEY (`clerkUserId`) REFERENCES `UserStats`(`clerkUserId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiagnosticResult` ADD CONSTRAINT `DiagnosticResult_clerkUserId_fkey` FOREIGN KEY (`clerkUserId`) REFERENCES `UserStats`(`clerkUserId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReadingSession` ADD CONSTRAINT `ReadingSession_clerkUserId_fkey` FOREIGN KEY (`clerkUserId`) REFERENCES `UserStats`(`clerkUserId`) ON DELETE RESTRICT ON UPDATE CASCADE;
