-- CreateTable
CREATE TABLE "morphology_paradigms" (
    "id" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "conceptId" TEXT,
    "term" TEXT NOT NULL,
    "gloss" TEXT NOT NULL,
    "gender" TEXT,
    "pattern" TEXT NOT NULL,
    "forms" JSONB NOT NULL,
    "examples" JSONB NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "morphology_paradigms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "morphology_paradigms_languageCode_idx" ON "morphology_paradigms"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "morphology_paradigms_languageCode_term_key" ON "morphology_paradigms"("languageCode", "term");
