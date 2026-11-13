-- Shared Google Drive folders / files per client
CREATE TABLE "DriveLink" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriveLink_clientId_idx" ON "DriveLink"("clientId");

ALTER TABLE "DriveLink" ADD CONSTRAINT "DriveLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
