-- CreateTable
CREATE TABLE "speech_clips" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "data" BYTEA NOT NULL,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speech_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "speech_clips_hash_key" ON "speech_clips"("hash");

-- CreateIndex
CREATE INDEX "speech_clips_languageCode_idx" ON "speech_clips"("languageCode");
