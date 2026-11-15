-- Optional emoji per content pillar
ALTER TABLE "Pillar" ADD COLUMN "icon" TEXT;

-- Clients moved to the Trash (deleted for good after 30 days)
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);
