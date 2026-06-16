ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_email_key";
ALTER TABLE "activity" ALTER COLUMN "payload" TYPE varchar(1000) USING "payload"::text;
