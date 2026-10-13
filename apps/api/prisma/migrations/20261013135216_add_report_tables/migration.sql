-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "branch" TEXT,
    "ci_run_id" TEXT,
    "ci_run_attempt" INTEGER,
    "ci_job" TEXT,
    "processing_state" TEXT NOT NULL DEFAULT 'pending',
    "processing_attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "collision_warning" JSONB,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "claimed_at" TIMESTAMPTZ(3),
    "next_attempt_at" TIMESTAMPTZ(3),

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_content" (
    "report_id" UUID NOT NULL,
    "body" BYTEA NOT NULL,

    CONSTRAINT "report_content_pkey" PRIMARY KEY ("report_id")
);

-- CreateIndex
CREATE INDEX "report_processing_state_next_attempt_at_received_at_idx" ON "report"("processing_state", "next_attempt_at", "received_at");

-- CreateIndex
CREATE INDEX "report_project_id_received_at_idx" ON "report"("project_id", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "report_project_id_commit_sha_content_hash_key" ON "report"("project_id", "commit_sha", "content_hash");

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_content" ADD CONSTRAINT "report_content_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
