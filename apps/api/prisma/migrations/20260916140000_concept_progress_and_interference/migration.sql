-- AlterTable
ALTER TABLE "errors" ADD COLUMN "sourceLanguageId" TEXT;

-- CreateIndex
CREATE INDEX "errors_userId_sourceLanguageId_idx" ON "errors"("userId", "sourceLanguageId");

-- AddForeignKey
ALTER TABLE "errors" ADD CONSTRAINT "errors_sourceLanguageId_fkey" FOREIGN KEY ("sourceLanguageId") REFERENCES "languages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "concept_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "meaningStrength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "anchorLanguageId" TEXT,
    "firstLearnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concept_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concept_progress_userId_conceptId_key" ON "concept_progress"("userId", "conceptId");

-- CreateIndex
CREATE INDEX "concept_progress_userId_meaningStrength_idx" ON "concept_progress"("userId", "meaningStrength");

-- AddForeignKey
ALTER TABLE "concept_progress" ADD CONSTRAINT "concept_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concept_progress" ADD CONSTRAINT "concept_progress_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
