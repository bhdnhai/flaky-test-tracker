-- CreateTable
CREATE TABLE "test" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "classname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "commit_sha" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "failure_message" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_project_id_classname_name_key" ON "test"("project_id", "classname", "name");

-- CreateIndex
-- INCLUDE columns make this an index-only scan for Flake aggregation (design §6, NFR-03);
-- Prisma's schema syntax has no INCLUDE clause, so this is hand-added to the generated SQL.
CREATE INDEX "outcome_project_id_test_id_commit_sha_idx" ON "outcome"("project_id", "test_id", "commit_sha") INCLUDE ("result", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "outcome_report_id_test_id_key" ON "outcome"("report_id", "test_id");

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome" ADD CONSTRAINT "outcome_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
