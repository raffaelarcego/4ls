-- CreateTable
CREATE TABLE "can_do_lessons" (
    "id" TEXT NOT NULL,
    "canDoId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "sentences" JSONB NOT NULL,
    "contrast" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "can_do_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "can_do_lessons_canDoId_level_idx" ON "can_do_lessons"("canDoId", "level");
