-- Allow many published courses (`status` = ACTIVE) while enforcing a single default course (`isActive` = true).
-- If legacy/manual data contains multiple defaults, keep the most recently activated/updated course as the default.
WITH ranked_defaults AS (
  SELECT
    id,
    row_number() OVER (
      ORDER BY "activatedAt" DESC NULLS LAST, "updatedAt" DESC, "createdAt" DESC
    ) AS rank
  FROM "Course"
  WHERE "isActive" = true
)
UPDATE "Course"
SET "isActive" = false,
    "activatedAt" = NULL
WHERE id IN (
  SELECT id FROM ranked_defaults WHERE rank > 1
);

UPDATE "Course"
SET "status" = 'ACTIVE',
    "archivedAt" = NULL
WHERE "isActive" = true
  AND "status" <> 'ACTIVE';

CREATE UNIQUE INDEX "Course_single_default_course_idx"
ON "Course" ("isActive")
WHERE "isActive" = true;
