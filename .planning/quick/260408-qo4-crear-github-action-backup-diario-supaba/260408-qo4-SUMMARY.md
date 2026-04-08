---
phase: quick
plan: 260408-qo4
subsystem: infra/backup
tags: [github-actions, backup, cloudflare-r2, postgresql, supabase]
dependency_graph:
  requires: []
  provides: [daily-db-backup, r2-rotation]
  affects: []
tech_stack:
  added: [github-actions, aws-cli, postgresql-client]
  patterns: [scheduled-workflow, bash-script, object-storage-rotation]
key_files:
  created:
    - .github/workflows/supabase-backup.yml
    - scripts/supabase-backup.sh
  modified: []
decisions:
  - "pg_dump --format=custom --no-owner --no-acl for compact restorable dumps"
  - "aws s3api list-objects-v2 with sort_by LastModified for deterministic rotation order"
  - "Rotation deletes oldest-first until count <= 10"
  - "All credentials from GitHub secrets — zero hardcoded values"
metrics:
  duration: ~2min
  completed: 2026-04-08
  tasks: 1
  files: 2
---

# Quick Task 260408-qo4: Daily Supabase Backup to Cloudflare R2 Summary

**One-liner:** GitHub Actions workflow running daily pg_dump to Cloudflare R2 with automatic 10-copy rotation via aws s3api.

## What Was Built

A two-file solution for automated daily backups of the Supabase PostgreSQL database:

1. **`.github/workflows/supabase-backup.yml`** — Scheduled GitHub Actions workflow (cron `0 5 * * *` = 5am UTC = 2am Argentina). Includes `workflow_dispatch` for manual runs. Installs `postgresql-client` and `awscli` at runtime, then calls the backup script. All secrets injected from GitHub Actions secrets.

2. **`scripts/supabase-backup.sh`** — Bash script with `set -euo pipefail`. Validates 5 required env vars (`DATABASE_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Runs `pg_dump --format=custom --no-owner --no-acl`. Uploads via `aws s3 cp` with R2 endpoint. Lists bucket objects sorted by `LastModified`, deletes oldest until only 10 remain. Prints summary and cleans up temp file.

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create backup script and GitHub Actions workflow | Done | ab106c8 |
| 2 | Human verify (checkpoint) | Pending | — |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## GitHub Secrets Required

Before the workflow can run, add these 5 secrets in repo Settings > Secrets and variables > Actions:

| Secret | Description |
|--------|-------------|
| `SUPABASE_DB_URL` | Supabase connection string (Settings > Database > Connection string > URI with password) |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint (e.g., `https://<account-id>.r2.cloudflarestorage.com`) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | Name of the R2 bucket |

## Self-Check: PASSED

- `.github/workflows/supabase-backup.yml` exists: FOUND
- `scripts/supabase-backup.sh` exists: FOUND
- Script is executable: FOUND
- Bash syntax check passes: PASSED
- Workflow name matches "Daily Supabase Backup": PASSED
- Cron `0 5 * * *` present: PASSED
- Commit ab106c8 exists: FOUND
