-- Allow automatic moderation reports that are created by the system.
ALTER TABLE "Report" DROP CONSTRAINT "Report_creatorId_fkey";
ALTER TABLE "Report" ALTER COLUMN "creatorId" DROP NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
