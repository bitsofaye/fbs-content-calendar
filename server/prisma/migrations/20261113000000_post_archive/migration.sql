-- Archived posts are hidden everywhere but kept (and can be restored)
ALTER TABLE "Post" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Post_clientId_archivedAt_idx" ON "Post"("clientId", "archivedAt");
