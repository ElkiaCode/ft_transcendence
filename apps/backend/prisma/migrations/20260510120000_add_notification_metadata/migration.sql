-- Add structured context so notifications can point back to the action that created them.
ALTER TABLE "Notification"
ADD COLUMN "actorId" TEXT,
ADD COLUMN "entityType" TEXT,
ADD COLUMN "entityId" TEXT,
ADD COLUMN "action" TEXT,
ADD COLUMN "metadata" JSONB;

CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
