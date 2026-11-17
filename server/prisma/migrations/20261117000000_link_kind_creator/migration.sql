-- Links can be Drive links (DRIVE) or other file / website links (FILE), and remember who added them
ALTER TABLE "DriveLink" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'DRIVE';
ALTER TABLE "DriveLink" ADD COLUMN "createdById" TEXT;

CREATE INDEX "DriveLink_clientId_kind_idx" ON "DriveLink"("clientId", "kind");

ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
