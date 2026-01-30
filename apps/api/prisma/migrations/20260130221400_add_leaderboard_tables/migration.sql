-- CreateTable
CREATE TABLE `LeaderboardSettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `participate` BOOLEAN NOT NULL DEFAULT false,
    `hideUid` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaderboardSettings_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaderboardCache` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `gameAccountId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `displayUid` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `uidHidden` BOOLEAN NOT NULL DEFAULT false,
    `cachedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeaderboardCache_type_idx`(`type`),
    INDEX `LeaderboardCache_gameAccountId_idx`(`gameAccountId`),
    INDEX `LeaderboardCache_userId_idx`(`userId`),
    UNIQUE INDEX `LeaderboardCache_type_rank_key`(`type`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaderboardSettings` ADD CONSTRAINT `LeaderboardSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
