-- CreateTable
CREATE TABLE "reading_passages" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "versions" JSONB NOT NULL,
    "contrast" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_passages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_passages_topicId_level_idx" ON "reading_passages"("topicId", "level");
