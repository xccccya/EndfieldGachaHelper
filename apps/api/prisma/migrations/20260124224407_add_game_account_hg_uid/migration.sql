-- AlterTable
ALTER TABLE `GameAccount` ADD COLUMN `hgUid` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `GameAccount_userId_hgUid_idx` ON `GameAccount`(`userId`, `hgUid`);
