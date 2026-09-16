-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gloss" TEXT NOT NULL,
    "note" TEXT,
    "level" "CefrLevel" NOT NULL DEFAULT 'A1',
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "concepts_slug_key" ON "concepts"("slug");

-- AlterTable
ALTER TABLE "vocabulary" ADD COLUMN "conceptId" TEXT;

-- CreateIndex
CREATE INDEX "vocabulary_conceptId_idx" ON "vocabulary"("conceptId");

-- AddForeignKey
ALTER TABLE "vocabulary" ADD CONSTRAINT "vocabulary_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "sentence_patterns" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "pitfalls" JSONB NOT NULL,
    "drills" JSONB NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentence_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sentence_patterns_languageCode_level_idx" ON "sentence_patterns"("languageCode", "level");

-- CreateIndex
CREATE INDEX "sentence_patterns_languageCode_patternId_idx" ON "sentence_patterns"("languageCode", "patternId");
