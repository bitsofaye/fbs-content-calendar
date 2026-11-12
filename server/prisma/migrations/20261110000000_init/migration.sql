-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('ORGANIC', 'AD');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('IDEA', 'IN_PROGRESS', 'CREATED', 'EDITED', 'TO_EDIT', 'FOR_APPROVAL', 'APPROVED', 'REJECTED', 'ON_HOLD', 'RESCHEDULE', 'SCHEDULED', 'PUBLISHED', 'BOOSTED');

-- CreateEnum
CREATE TYPE "Placement" AS ENUM ('FB_POST', 'IG_POST', 'LINKEDIN_POST', 'FB_REELS', 'IG_REELS', 'YT_SHORTS', 'YT_CLIPS', 'YT_VIDEO', 'TIKTOK', 'STORY');

-- CreateEnum
CREATE TYPE "Boost" AS ENUM ('ORGANIC', 'PAID', 'BOOSTED');

-- CreateEnum
CREATE TYPE "Feedback" AS ENUM ('EXCELLENT', 'GOOD', 'BAD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "clientId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandColor" TEXT NOT NULL DEFAULT '#2563eb',
    "logoUrl" TEXT,
    "industry" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pillar" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "weekday" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyTheme" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "weeklyFocus" JSONB,
    "notes" TEXT,

    CONSTRAINT "MonthlyTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pillarId" TEXT,
    "kind" "PostKind" NOT NULL DEFAULT 'ORGANIC',
    "date" DATE,
    "time" TEXT,
    "title" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "placements" "Placement"[],
    "format" TEXT,
    "storyboard" TEXT,
    "graphicsIdea" TEXT,
    "titleDraft" TEXT,
    "caption" TEXT,
    "hashtags" TEXT,
    "pubmatLinks" TEXT[],
    "referenceLink" TEXT,
    "remarks" TEXT,
    "boost" "Boost" NOT NULL DEFAULT 'ORGANIC',
    "approverId" TEXT,
    "approverName" TEXT,
    "assigneeId" TEXT,
    "reacts" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "reach" INTEGER,
    "engagement" INTEGER,
    "linkClicks" INTEGER,
    "feedback" "Feedback",
    "adDetails" JSONB,
    "importSource" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pillar_clientId_name_key" ON "Pillar"("clientId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyTheme_clientId_year_month_key" ON "MonthlyTheme"("clientId", "year", "month");

-- CreateIndex
CREATE INDEX "Post_clientId_date_idx" ON "Post"("clientId", "date");

-- CreateIndex
CREATE INDEX "Post_clientId_status_idx" ON "Post"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Post_clientId_importSource_key" ON "Post"("clientId", "importSource");

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX "ActivityLog_postId_idx" ON "ActivityLog"("postId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pillar" ADD CONSTRAINT "Pillar_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyTheme" ADD CONSTRAINT "MonthlyTheme_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "Pillar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

