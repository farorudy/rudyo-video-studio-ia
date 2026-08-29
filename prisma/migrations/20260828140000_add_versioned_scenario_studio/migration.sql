CREATE TYPE "ScenarioVersionStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'VALIDATED', 'SUPERSEDED', 'FAILED');
CREATE TYPE "StoryboardFrameStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');
CREATE TYPE "VisualReferenceKind" AS ENUM ('CAST', 'LOCATION', 'PROP');

CREATE TABLE "ScenarioVersion" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL, "status" "ScenarioVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "audioDurationMs" INTEGER NOT NULL, "sourcePrompt" TEXT NOT NULL, "sourceFingerprint" TEXT NOT NULL,
  "contentHash" TEXT, "structureJson" JSONB, "model" TEXT, "provider" TEXT,
  "promptTokens" INTEGER, "completionTokens" INTEGER, "estimatedCostCents" INTEGER,
  "validatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ScenarioVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScenarioScene" (
  "id" TEXT NOT NULL, "scenarioVersionId" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "startMs" INTEGER NOT NULL, "endMs" INTEGER NOT NULL,
  "narrativeContent" TEXT NOT NULL, "emotionalArc" TEXT NOT NULL, "soundVibe" TEXT NOT NULL,
  "contextualPosition" TEXT NOT NULL, "pacing" TEXT NOT NULL, "transitionOut" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScenarioScene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScenarioShot" (
  "id" TEXT NOT NULL, "sceneId" TEXT NOT NULL, "legacySceneId" TEXT,
  "position" INTEGER NOT NULL, "startMs" INTEGER NOT NULL, "endMs" INTEGER NOT NULL,
  "shotFunction" TEXT NOT NULL, "startFrame" TEXT NOT NULL, "actionAndCamera" TEXT NOT NULL,
  "environmentalDynamics" TEXT NOT NULL, "endFrame" TEXT NOT NULL, "seedancePrompt" TEXT NOT NULL,
  "cameraMovement" TEXT NOT NULL, "continuityJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScenarioShot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryboardFrame" (
  "id" TEXT NOT NULL, "shotId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "status" "StoryboardFrameStatus" NOT NULL DEFAULT 'PENDING', "storageKey" TEXT,
  "thumbnailStorageKey" TEXT, "model" TEXT, "provider" TEXT, "sourcePromptHash" TEXT,
  "estimatedCostCents" INTEGER, "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryboardFrame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisualReference" (
  "id" TEXT NOT NULL, "scenarioVersionId" TEXT NOT NULL, "stableKey" TEXT NOT NULL,
  "kind" "VisualReferenceKind" NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL,
  "storageKey" TEXT, "continuityJson" JSONB NOT NULL,
  CONSTRAINT "VisualReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScenarioVersion_projectId_version_key" ON "ScenarioVersion"("projectId", "version");
CREATE INDEX "ScenarioVersion_userId_projectId_idx" ON "ScenarioVersion"("userId", "projectId");
CREATE INDEX "ScenarioVersion_projectId_status_idx" ON "ScenarioVersion"("projectId", "status");
CREATE UNIQUE INDEX "ScenarioScene_scenarioVersionId_position_key" ON "ScenarioScene"("scenarioVersionId", "position");
CREATE INDEX "ScenarioShot_legacySceneId_idx" ON "ScenarioShot"("legacySceneId");
CREATE UNIQUE INDEX "ScenarioShot_sceneId_position_key" ON "ScenarioShot"("sceneId", "position");
CREATE INDEX "ScenarioShot_sceneId_startMs_idx" ON "ScenarioShot"("sceneId", "startMs");
CREATE UNIQUE INDEX "StoryboardFrame_shotId_key" ON "StoryboardFrame"("shotId");
CREATE INDEX "StoryboardFrame_userId_status_idx" ON "StoryboardFrame"("userId", "status");
CREATE UNIQUE INDEX "VisualReference_scenarioVersionId_stableKey_key" ON "VisualReference"("scenarioVersionId", "stableKey");

ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenarioVersion" ADD CONSTRAINT "ScenarioVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenarioScene" ADD CONSTRAINT "ScenarioScene_scenarioVersionId_fkey" FOREIGN KEY ("scenarioVersionId") REFERENCES "ScenarioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenarioShot" ADD CONSTRAINT "ScenarioShot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ScenarioScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScenarioShot" ADD CONSTRAINT "ScenarioShot_legacySceneId_fkey" FOREIGN KEY ("legacySceneId") REFERENCES "StoryboardScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoryboardFrame" ADD CONSTRAINT "StoryboardFrame_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "ScenarioShot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryboardFrame" ADD CONSTRAINT "StoryboardFrame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualReference" ADD CONSTRAINT "VisualReference_scenarioVersionId_fkey" FOREIGN KEY ("scenarioVersionId") REFERENCES "ScenarioVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
