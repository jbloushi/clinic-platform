-- Give any pre-existing Service a slug before the column becomes required.
--
-- Doing this in SQL rather than in the backfill script keeps the ordering
-- atomic: `prisma migrate deploy` applies the nullable-column migration and this
-- one back to back, with no application step in between that an operator could
-- forget. A fresh database has no rows here, so every statement is a no-op.
UPDATE `service`
SET `slug` = LOWER(
  TRIM(BOTH '-' FROM
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      `name`,
      '&', 'and'), ' ', '-'), '(', ''), ')', ''), '/', '-'), ',', ''), '.', ''), '--', '-')
  )
)
WHERE `slug` IS NULL;

-- Names that collapse to the same slug: disambiguate so the unique index can be
-- created. Rare; ops can rename afterwards.
UPDATE `service` s
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `slug` ORDER BY `createdAt`, `id`) AS rn
  FROM `service`
  WHERE `slug` IS NOT NULL
) d ON d.`id` = s.`id`
SET s.`slug` = CONCAT(s.`slug`, '-', d.rn)
WHERE d.rn > 1;

-- A name of only punctuation would leave this empty; give it a stable fallback.
UPDATE `service` SET `slug` = CONCAT('service-', `id`) WHERE `slug` IS NULL OR `slug` = '';

-- AlterTable
ALTER TABLE `service` MODIFY `slug` VARCHAR(191) NOT NULL;

