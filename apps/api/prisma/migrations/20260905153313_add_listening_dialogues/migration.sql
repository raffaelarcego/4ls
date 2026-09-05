-- CreateTable
CREATE TABLE "listening_dialogues" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "vocabulary" JSONB,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_dialogues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listening_dialogues_languageCode_level_idx" ON "listening_dialogues"("languageCode", "level");
