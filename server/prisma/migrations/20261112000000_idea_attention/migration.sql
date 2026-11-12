-- Idea bank: flag an idea for the team's attention
ALTER TABLE "Post" ADD COLUMN "needsAttention" BOOLEAN NOT NULL DEFAULT false;
