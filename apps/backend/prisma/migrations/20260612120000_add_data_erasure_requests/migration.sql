-- CreateTable
CREATE TABLE "DataErasureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataErasureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataErasureRequest_userId_key" ON "DataErasureRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DataErasureRequest_tokenHash_key" ON "DataErasureRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "DataErasureRequest_expiresAt_idx" ON "DataErasureRequest"("expiresAt");

-- AddForeignKey
ALTER TABLE "DataErasureRequest"
ADD CONSTRAINT "DataErasureRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
