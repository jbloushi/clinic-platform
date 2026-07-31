-- DropIndex
DROP INDEX `PractitionerBranch_specialistOpenemrUuid_idx` ON `practitionerbranch`;

-- AlterTable
ALTER TABLE `bookinghold` ADD COLUMN `assignedAutomatically` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `assignmentMetadata` JSON NULL,
    ADD COLUMN `assignmentMode` ENUM('AUTO', 'PATIENT_SELECTED', 'OPS_ASSIGNED') NULL,
    ADD COLUMN `assignmentReason` VARCHAR(64) NULL,
    ADD COLUMN `bookingEntryPath` ENUM('SERVICE_PATH', 'DOCTOR_PATH', 'OPS') NULL,
    ADD COLUMN `branchNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `departmentNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `eligibleDoctorCount` INTEGER NULL,
    ADD COLUMN `openemrCategoryIdSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `practitionerNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `practitionerOfferingId` VARCHAR(191) NULL,
    ADD COLUMN `serviceDurationSnapshot` INTEGER NULL,
    ADD COLUMN `serviceNameSnapshot` VARCHAR(191) NULL,
    ADD COLUMN `servicePriceSnapshot` INTEGER NULL;

-- AlterTable
ALTER TABLE `practitionerbranch` ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `ServiceDepartment` (
    `serviceId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ServiceDepartment_departmentId_active_sortOrder_idx`(`departmentId`, `active`, `sortOrder`),
    INDEX `ServiceDepartment_serviceId_isPrimary_idx`(`serviceId`, `isPrimary`),
    PRIMARY KEY (`serviceId`, `departmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceBranch` (
    `serviceId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `publishedOnWeb` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `practitionerSelectionMode` ENUM('AUTO', 'PATIENT_CHOICE', 'AUTO_OR_PATIENT_CHOICE', 'OPS_ONLY') NOT NULL DEFAULT 'AUTO_OR_PATIENT_CHOICE',
    `durationMinutes` INTEGER NULL,
    `priceMinor` INTEGER NULL,

    INDEX `ServiceBranch_branchId_active_publishedOnWeb_idx`(`branchId`, `active`, `publishedOnWeb`),
    PRIMARY KEY (`serviceId`, `branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PractitionerOffering` (
    `id` VARCHAR(191) NOT NULL,
    `specialistOpenemrUuid` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `publishedOnWeb` BOOLEAN NOT NULL DEFAULT true,
    `allowAutoAssignment` BOOLEAN NOT NULL DEFAULT true,
    `allowPatientChoice` BOOLEAN NOT NULL DEFAULT true,
    `assignmentPriority` INTEGER NOT NULL DEFAULT 100,
    `assignmentPriorityTier` ENUM('PREFERRED', 'NORMAL', 'BACKUP') NOT NULL DEFAULT 'NORMAL',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `durationMinutes` INTEGER NULL,
    `priceMinor` INTEGER NULL,
    `lastAutoAssignedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PractitionerOffering_branchId_serviceId_active_idx`(`branchId`, `serviceId`, `active`),
    INDEX `PractitionerOffering_specialistOpenemrUuid_branchId_active_idx`(`specialistOpenemrUuid`, `branchId`, `active`),
    INDEX `PractitionerOffering_departmentId_serviceId_branchId_idx`(`departmentId`, `serviceId`, `branchId`),
    INDEX `PractitionerOffering_allowAutoAssignment_assignmentPriority_idx`(`allowAutoAssignment`, `assignmentPriority`),
    UNIQUE INDEX `PractitionerOffering_specialistOpenemrUuid_serviceId_departm_key`(`specialistOpenemrUuid`, `serviceId`, `departmentId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AvailabilityRule` (
    `id` VARCHAR(191) NOT NULL,
    `specialistOpenemrUuid` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `weekday` INTEGER NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `slotMinutes` INTEGER NOT NULL DEFAULT 20,
    `validFrom` DATETIME(3) NULL,
    `validUntil` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AvailabilityRule_specialistOpenemrUuid_branchId_weekday_acti_idx`(`specialistOpenemrUuid`, `branchId`, `weekday`, `active`),
    INDEX `AvailabilityRule_branchId_active_idx`(`branchId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DepartmentOpenemrMapping` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DepartmentOpenemrMapping_departmentId_active_idx`(`departmentId`, `active`),
    UNIQUE INDEX `DepartmentOpenemrMapping_entityType_externalId_key`(`entityType`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceOpenemrMapping` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceOpenemrMapping_entityType_externalId_idx`(`entityType`, `externalId`),
    UNIQUE INDEX `ServiceOpenemrMapping_serviceId_entityType_key`(`serviceId`, `entityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'singleton',
    `preferPreviousPractitioner` BOOLEAN NOT NULL DEFAULT true,
    `workloadWindowDays` INTEGER NOT NULL DEFAULT 30,
    `useLeastRecentlyAssigned` BOOLEAN NOT NULL DEFAULT true,
    `allowBackupTier` BOOLEAN NOT NULL DEFAULT true,
    `holdDurationMinutes` INTEGER NOT NULL DEFAULT 15,
    `slotSearchWindowDays` INTEGER NOT NULL DEFAULT 30,
    `slotQuantumMinutes` INTEGER NOT NULL DEFAULT 5,
    `showDoctorNameBeforePayment` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PractitionerSlotLock` (
    `id` VARCHAR(191) NOT NULL,
    `holdId` VARCHAR(191) NOT NULL,
    `specialistOpenemrUuid` VARCHAR(191) NOT NULL,
    `slotBucketUtc` DATETIME(3) NOT NULL,

    INDEX `PractitionerSlotLock_holdId_idx`(`holdId`),
    UNIQUE INDEX `PractitionerSlotLock_specialistOpenemrUuid_slotBucketUtc_key`(`specialistOpenemrUuid`, `slotBucketUtc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingChange` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `type` ENUM('CREATED', 'HOLD_CREATED', 'AUTO_ASSIGNED', 'REASSIGNED', 'PAYMENT_STARTED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'FINALIZATION_STARTED', 'FINALIZATION_FAILED', 'CONFIRMED', 'RESCHEDULED', 'BRANCH_CHANGED', 'PRACTITIONER_CHANGED', 'SERVICE_CHANGED', 'STATUS_CHANGED', 'CANCELLED', 'REFUNDED', 'RESTORED') NOT NULL,
    `changedById` VARCHAR(191) NULL,
    `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `previousData` JSON NULL,
    `newData` JSON NOT NULL,
    `reason` TEXT NULL,

    INDEX `BookingChange_bookingId_changedAt_idx`(`bookingId`, `changedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PractitionerBranch_branchId_active_idx` ON `PractitionerBranch`(`branchId`, `active`);

-- CreateIndex
CREATE INDEX `PractitionerBranch_specialistOpenemrUuid_active_idx` ON `PractitionerBranch`(`specialistOpenemrUuid`, `active`);

-- AddForeignKey
ALTER TABLE `ServiceDepartment` ADD CONSTRAINT `ServiceDepartment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceDepartment` ADD CONSTRAINT `ServiceDepartment_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceBranch` ADD CONSTRAINT `ServiceBranch_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceBranch` ADD CONSTRAINT `ServiceBranch_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PractitionerOffering` ADD CONSTRAINT `PractitionerOffering_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PractitionerOffering` ADD CONSTRAINT `PractitionerOffering_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PractitionerOffering` ADD CONSTRAINT `PractitionerOffering_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AvailabilityRule` ADD CONSTRAINT `AvailabilityRule_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DepartmentOpenemrMapping` ADD CONSTRAINT `DepartmentOpenemrMapping_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceOpenemrMapping` ADD CONSTRAINT `ServiceOpenemrMapping_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PractitionerSlotLock` ADD CONSTRAINT `PractitionerSlotLock_holdId_fkey` FOREIGN KEY (`holdId`) REFERENCES `BookingHold`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingChange` ADD CONSTRAINT `BookingChange_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `BookingHold`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingHold` ADD CONSTRAINT `BookingHold_practitionerOfferingId_fkey` FOREIGN KEY (`practitionerOfferingId`) REFERENCES `PractitionerOffering`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Assignment settings are a single row the engine always expects to find.
-- Seeding it here means no code path has to cope with its absence.
INSERT INTO `AssignmentSettings` (`id`, `updatedAt`) VALUES ('singleton', NOW(3));
