#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Supabase PostgreSQL Backup Script
# Dumps the database, uploads to Cloudflare R2, and retains only the last 10.
# ==============================================================================

# --- Validate required environment variables ----------------------------------

required_vars=(DATABASE_URL R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: Required environment variable '$var' is not set." >&2
    exit 1
  fi
done

# --- Configure AWS CLI for Cloudflare R2 --------------------------------------

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

R2_PREFIX="supabase-backups"
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
BACKUP_FILE="backup-${TIMESTAMP}.dump"
BACKUP_PATH="/tmp/${BACKUP_FILE}"
R2_KEY="${R2_PREFIX}/${BACKUP_FILE}"

# --- Dump the database --------------------------------------------------------

echo "==> Dumping database to ${BACKUP_PATH} ..."
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" --file "$BACKUP_PATH"

BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo "    Dump size: ${BACKUP_SIZE}"

# --- Upload to Cloudflare R2 --------------------------------------------------

echo "==> Uploading ${BACKUP_FILE} to s3://${R2_BUCKET_NAME}/${R2_KEY} ..."
aws s3 cp "$BACKUP_PATH" "s3://${R2_BUCKET_NAME}/${R2_KEY}" \
  --endpoint-url "$R2_ENDPOINT"

echo "    Upload complete."

# --- Rotate: keep only the last 10 backups ------------------------------------

echo "==> Listing existing backups under '${R2_PREFIX}/' ..."

# List all objects under the prefix, sorted by LastModified (oldest first).
# aws s3api list-objects-v2 returns JSON; we extract keys sorted by date.
OBJECTS_JSON=$(aws s3api list-objects-v2 \
  --bucket "$R2_BUCKET_NAME" \
  --prefix "${R2_PREFIX}/" \
  --query 'Contents | sort_by(@, &LastModified)' \
  --output json \
  --endpoint-url "$R2_ENDPOINT")

# Parse keys into an array (one per line)
OBJECT_KEYS=()
while IFS= read -r key; do
  [[ -n "$key" ]] && OBJECT_KEYS+=("$key")
done < <(echo "$OBJECTS_JSON" | grep '"Key"' | sed 's/.*"Key": "\(.*\)".*/\1/')

TOTAL=${#OBJECT_KEYS[@]}
MAX_BACKUPS=10
DELETED=0

echo "    Total backups in bucket: ${TOTAL}"

if [[ "$TOTAL" -gt "$MAX_BACKUPS" ]]; then
  EXCESS=$(( TOTAL - MAX_BACKUPS ))
  echo "==> Rotating — deleting ${EXCESS} oldest backup(s) ..."
  for (( i=0; i<EXCESS; i++ )); do
    OLD_KEY="${OBJECT_KEYS[$i]}"
    echo "    Deleting: ${OLD_KEY}"
    aws s3 rm "s3://${R2_BUCKET_NAME}/${OLD_KEY}" \
      --endpoint-url "$R2_ENDPOINT"
    DELETED=$(( DELETED + 1 ))
  done
fi

REMAINING=$(( TOTAL - DELETED ))

# --- Summary ------------------------------------------------------------------

echo ""
echo "=============================="
echo "  Backup Summary"
echo "=============================="
echo "  File uploaded : ${BACKUP_FILE}"
echo "  Size          : ${BACKUP_SIZE}"
echo "  Files deleted : ${DELETED}"
echo "  Backups total : ${REMAINING}"
echo "=============================="

# Cleanup local temp file
rm -f "$BACKUP_PATH"
