-- AlterTable
ALTER TABLE `bookinghold` ADD COLUMN `branchId` VARCHAR(191) NULL,
    ADD COLUMN `openemrFacilityId` INTEGER NULL;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `branchId` VARCHAR(191) NULL,
    ADD COLUMN `departmentId` VARCHAR(191) NULL,
    ADD COLUMN `nameAr` VARCHAR(191) NULL,
    ADD COLUMN `publishedOnWeb` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `summaryAr` TEXT NULL,
    ADD COLUMN `summaryEn` TEXT NULL,
    -- Existing rows need a value for a NOT NULL column. Prisma emits this
    -- without a default, which MySQL fills with a zero-date and strict mode
    -- then rejects. Seed from createdAt so the timestamp is truthful, then drop
    -- the default back to Prisma's expectation.
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

UPDATE `service` SET `updatedAt` = `createdAt`;
ALTER TABLE `service` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `openemrFacilityId` INTEGER NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `areaEn` VARCHAR(191) NOT NULL,
    `areaAr` VARCHAR(191) NOT NULL,
    `addressLine` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `mapUrl` TEXT NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Branch_slug_key`(`slug`),
    UNIQUE INDEX `Branch_openemrFacilityId_key`(`openemrFacilityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nameEn` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `summaryEn` TEXT NOT NULL,
    `summaryAr` TEXT NOT NULL,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentSpecialty` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NOT NULL,
    `specialtyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DepartmentSpecialty_specialtyKey_idx`(`specialtyKey`),
    UNIQUE INDEX `DepartmentSpecialty_departmentId_specialtyKey_key`(`departmentId`, `specialtyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PractitionerBranch` (
    `id` VARCHAR(191) NOT NULL,
    `specialistOpenemrUuid` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PractitionerBranch_branchId_idx`(`branchId`),
    INDEX `PractitionerBranch_specialistOpenemrUuid_idx`(`specialistOpenemrUuid`),
    UNIQUE INDEX `PractitionerBranch_specialistOpenemrUuid_branchId_key`(`specialistOpenemrUuid`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `BookingHold_branchId_idx` ON `BookingHold`(`branchId`);

-- CreateIndex
CREATE UNIQUE INDEX `Service_slug_key` ON `Service`(`slug`);

-- CreateIndex
CREATE INDEX `Service_departmentId_idx` ON `Service`(`departmentId`);

-- CreateIndex
CREATE INDEX `Service_branchId_idx` ON `Service`(`branchId`);

-- AddForeignKey
ALTER TABLE `DepartmentSpecialty` ADD CONSTRAINT `DepartmentSpecialty_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PractitionerBranch` ADD CONSTRAINT `PractitionerBranch_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingHold` ADD CONSTRAINT `BookingHold_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

