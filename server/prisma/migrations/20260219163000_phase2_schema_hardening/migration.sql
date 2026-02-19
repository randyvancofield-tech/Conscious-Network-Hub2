DO $$
BEGIN
  CREATE TYPE "SocialPostVisibility" AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" DROP DEFAULT;

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" TYPE "SocialPostVisibility"
USING (
  CASE
    WHEN lower(coalesce("visibility", '')) = 'private' THEN 'private'::"SocialPostVisibility"
    ELSE 'public'::"SocialPostVisibility"
  END
);

ALTER TABLE "SocialPost"
ALTER COLUMN "visibility" SET DEFAULT 'public'::"SocialPostVisibility";

ALTER TABLE "User"
DROP CONSTRAINT IF EXISTS "User_profileMedia_json_shape_check",
DROP CONSTRAINT IF EXISTS "User_privacySettings_json_shape_check",
DROP CONSTRAINT IF EXISTS "User_interests_json_shape_check";

ALTER TABLE "User"
ADD CONSTRAINT "User_profileMedia_json_shape_check"
CHECK (
  "profileMedia" IS NULL OR (
    jsonb_typeof("profileMedia") = 'object'
    AND jsonb_typeof("profileMedia"->'avatar') = 'object'
    AND jsonb_typeof("profileMedia"->'cover') = 'object'
    AND (
      ("profileMedia"->'avatar'->'url') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'url') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'avatar'->'storageProvider') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'storageProvider') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'avatar'->'objectKey') IS NULL
      OR jsonb_typeof("profileMedia"->'avatar'->'objectKey') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'url') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'url') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'storageProvider') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'storageProvider') IN ('string', 'null')
    )
    AND (
      ("profileMedia"->'cover'->'objectKey') IS NULL
      OR jsonb_typeof("profileMedia"->'cover'->'objectKey') IN ('string', 'null')
    )
  )
) NOT VALID;

ALTER TABLE "User"
ADD CONSTRAINT "User_privacySettings_json_shape_check"
CHECK (
  "privacySettings" IS NULL OR (
    jsonb_typeof("privacySettings") = 'object'
    AND ("privacySettings"->>'profileVisibility') IN ('public', 'private')
    AND jsonb_typeof("privacySettings"->'showEmail') = 'boolean'
    AND jsonb_typeof("privacySettings"->'allowMessages') = 'boolean'
    AND jsonb_typeof("privacySettings"->'blockedUsers') = 'array'
    AND NOT jsonb_path_exists(
      "privacySettings"->'blockedUsers',
      '$[*] ? (@.type() != "string")'
    )
  )
) NOT VALID;

ALTER TABLE "User"
ADD CONSTRAINT "User_interests_json_shape_check"
CHECK (
  "interests" IS NULL OR (
    jsonb_typeof("interests") = 'array'
    AND NOT jsonb_path_exists(
      "interests",
      '$[*] ? (@.type() != "string")'
    )
  )
) NOT VALID;
