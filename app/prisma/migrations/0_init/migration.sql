-- CreateTable
CREATE TABLE `StaffUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `openemrUserId` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StaffUser_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `openemrPatientUuid` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PatientIdentity_mobile_key`(`mobile`),
    UNIQUE INDEX `PatientIdentity_openemrPatientUuid_key`(`openemrPatientUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpCode_mobile_idx`(`mobile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SessionLog` (
    `id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `priceMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'KWD',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `showInServiceSearch` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceSpecialist` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `specialistOpenemrUuid` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ServiceSpecialist_serviceId_idx`(`serviceId`),
    INDEX `ServiceSpecialist_specialistOpenemrUuid_idx`(`specialistOpenemrUuid`),
    UNIQUE INDEX `ServiceSpecialist_serviceId_specialistOpenemrUuid_key`(`serviceId`, `specialistOpenemrUuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingHold` (
    `id` VARCHAR(191) NOT NULL,
    `patientIdentityId` VARCHAR(191) NULL,
    `practitionerOpenemrId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'held',
    `activeSlotKey` VARCHAR(255) NULL,
    `openemrAppointmentId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `holdExpiresAt` DATETIME(3) NOT NULL,
    `followUpFromBookingId` VARCHAR(191) NULL,
    `rescheduledFromBookingId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BookingHold_practitionerOpenemrId_startAt_idx`(`practitionerOpenemrId`, `startAt`),
    INDEX `BookingHold_followUpFromBookingId_idx`(`followUpFromBookingId`),
    INDEX `BookingHold_patientIdentityId_idx`(`patientIdentityId`),
    UNIQUE INDEX `BookingHold_activeSlotKey_key`(`activeSlotKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WalletTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'KWD',
    `source` VARCHAR(191) NOT NULL,
    `reference` TEXT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WalletTransaction_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `bookingHoldId` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NULL,
    `amountMinor` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'KWD',
    `method` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `externalRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

