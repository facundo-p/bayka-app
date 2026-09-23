#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Supabase PostgreSQL Backup Script
# Dumps the database, uploads to Cloudflare R2, and rotates (daily/weekly/monthly).
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

# --- Rotate: escalonada (#604) --------------------------------------------------
# Qué se conserva lo decide scripts/backupRetention.cjs: diarios de la última
# semana, semanales del último mes, mensuales del último año.

list_backup_keys() {
  aws s3api list-objects-v2 \
    --bucket "$R2_BUCKET_NAME" \
    --prefix "${R2_PREFIX}/" \
    --query 'Contents[].Key' \
    --output text \
    --endpoint-url "$R2_ENDPOINT" | tr '\t' '\n' | grep -v '^None$' || true
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RETENTION="${SCRIPT_DIR}/backupRetention.cjs"

echo "==> Listing existing backups under '${R2_PREFIX}/' ..."
OBJECT_KEYS=$(list_backup_keys)
TOTAL=$(grep -c . <<< "$OBJECT_KEYS" || true)
echo "    Total backups in bucket: ${TOTAL}"

# Recién subimos uno: un listado vacío es un error, no un bucket vacío. Sin este
# chequeo la rotación no corre y el workflow queda verde (#603).
if ! grep -qxF "$R2_KEY" <<< "$OBJECT_KEYS"; then
  echo "ERROR: el listado no incluye el backup recién subido (${R2_KEY})." >&2
  exit 1
fi

TO_DELETE=$(node "$RETENTION" <<< "$OBJECT_KEYS")
DELETED=0

while IFS= read -r old_key; do
  [[ -z "$old_key" ]] && continue
  echo "    Deleting: ${old_key}"
  aws s3 rm "s3://${R2_BUCKET_NAME}/${old_key}" --endpoint-url "$R2_ENDPOINT"
  DELETED=$(( DELETED + 1 ))
done <<< "$TO_DELETE"

REMAINING_KEYS=$(list_backup_keys)
REMAINING=$(grep -c . <<< "$REMAINING_KEYS" || true)
# Las keys con otro formato no rotan: la cota vale solo para los dumps diarios.
REMAINING_ROTABLES=$(grep -c 'backup-[0-9]\{8\}-[0-9]\{6\}\.dump$' <<< "$REMAINING_KEYS" || true)
MAX_BACKUPS=$(node -p "require('${RETENTION}').MAX_VIVOS")

if [[ "$REMAINING" -ne $(( TOTAL - DELETED )) || "$REMAINING_ROTABLES" -gt "$MAX_BACKUPS" ]]; then
  echo "ERROR: quedaron ${REMAINING} backups; se esperaban $(( TOTAL - DELETED )), como mucho ${MAX_BACKUPS}." >&2
  exit 1
fi

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
