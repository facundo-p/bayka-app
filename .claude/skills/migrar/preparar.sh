#!/usr/bin/env bash
# Muestra qué migraciones aplicaría `db push` en un entorno y arma el comando
# para aplicarlas. Solo lee la base (migration list y dry-run): el push lo corre
# Facu. Se puede invocar desde cualquier directorio o worktree del repo.
#
# Uso: preparar.sh <staging|prod>
set -euo pipefail

ENTORNO="${1:-}"
case "$ENTORNO" in
  staging) RAMA=staging; VAR_URL=STAGING_DB_URL ;;
  prod)    RAMA=main;    VAR_URL=PROD_DB_URL ;;
  *) echo "Uso: $0 <staging|prod>" >&2; exit 2 ;;
esac

# .env.migration no se versiona: existe solo en el checkout principal.
GIT_COMMON_DIR="$(git -C "$(dirname "$0")" rev-parse --path-format=absolute --git-common-dir)"
ROOT="$(dirname "$GIT_COMMON_DIR")"
ENV_FILE="$ROOT/.env.migration"
[ -f "$ENV_FILE" ] || { echo "No existe $ENV_FILE" >&2; exit 1; }

DB_URL="$(set -a; . "$ENV_FILE"; printf '%s' "${!VAR_URL:-}")"
[ -n "$DB_URL" ] || { echo "$VAR_URL está vacía en $ENV_FILE" >&2; exit 1; }

# db push aplica las migraciones del directorio en el que corre: se toman de la
# rama del entorno en origin, no de la rama local.
git -C "$ROOT" fetch -q origin "$RAMA"
REF="origin/$RAMA"
SHA="$(git -C "$ROOT" rev-parse --short "$REF")"
TMP_BASE="${TMPDIR:-/tmp}"
DIR="${TMP_BASE%/}/bayka-migraciones-$ENTORNO-$SHA"
rm -rf "$DIR"
mkdir -p "$DIR"
git -C "$ROOT" archive "$REF" supabase/config.toml supabase/migrations | tar -x -C "$DIR"

CLI_VERSION="$(git -C "$ROOT" show "$REF:supabase/tests/lib.sh" \
  | sed -n 's/^SUPABASE_CLI_VERSION="\(.*\)"$/\1/p')"
[ -n "$CLI_VERSION" ] || { echo "No encontré SUPABASE_CLI_VERSION en supabase/tests/lib.sh" >&2; exit 1; }
CLI=(npx --yes "supabase@$CLI_VERSION")

echo "== $ENTORNO · migraciones de $REF ($SHA)"
echo "== migration list"
"${CLI[@]}" migration list --workdir "$DIR" --db-url "$DB_URL" 2>&1
echo "== db push --dry-run"
if ! DRY_RUN="$("${CLI[@]}" db push --dry-run --workdir "$DIR" --db-url "$DB_URL" 2>&1)"; then
  echo "$DRY_RUN"
  echo "== El dry-run falló: no hay comando que correr hasta resolverlo." >&2
  exit 1
fi
echo "$DRY_RUN"

if grep -q '"upToDate":true' <<<"$DRY_RUN"; then
  echo "== Nada pendiente en $ENTORNO."
  exit 0
fi

# El subshell evita que las credenciales queden exportadas en la terminal de Facu,
# y el comando nombra la variable, no la URL, para no imprimir la contraseña.
printf '\n== Comando para aplicar (desde cualquier directorio):\n'
printf '( set -a; . %q; set +a; npx --yes supabase@%s db push --workdir %q --db-url "$%s" )\n' \
  "$ENV_FILE" "$CLI_VERSION" "$DIR" "$VAR_URL"
