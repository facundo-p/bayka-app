---
name: migrar
description: Prepara el comando exacto para aplicar a staging o prod las migraciones pendientes de supabase/migrations con `supabase db push`. Claude corre migration list y el dry-run; el push lo corre Facu con el comando que el skill arma, desde cualquier directorio.
trigger: Use when migrations need to be applied to staging or prod, after merging a PR that adds a file to supabase/migrations, or when Facu asks for the db push command.
---

# /migrar — comando de `db push` listo para correr

Claude no puede correr `db push` (deny en `.claude/settings.local.json`): el
push real lo corre Facu. Este skill le pasa un comando que no depende del
directorio en el que esté, porque el de `docs/db-baseline.md` falla fuera del
checkout principal de dos formas:

- `.env.migration` no se versiona y solo existe en el checkout principal. En un
  worktree no carga, la URL queda vacía y la CLI se conecta a un Postgres local.
- `db push` aplica las migraciones del directorio en el que corre. Desde un
  worktree aplicaría las de esa rama, no las del entorno.

## Uso

`/migrar` (staging) o `/migrar prod`.

## Pasos

1. **Entorno.** Staging por defecto. Prod solo después de mergear el pase
   staging → main y con confirmación explícita de Facu para ese push.

2. **Preparar.** Correr, desde cualquier directorio:

   ```sh
   bash .claude/skills/migrar/preparar.sh <staging|prod>
   ```

   El script:
   - extrae `supabase/` de `origin/staging` (o `origin/main` para prod) a un
     directorio temporal con el SHA en el nombre;
   - toma la versión de la CLI de `supabase/tests/lib.sh`;
   - corre `migration list` y `db push --dry-run` contra la base del entorno;
   - si hay pendientes, imprime el comando para aplicarlas. Si no, dice
     "Nada pendiente" y no imprime comando.

3. **Revisar el dry-run** antes de pasar el comando:
   - Las migraciones listadas tienen que ser las esperadas.
   - Si el dry-run pide `--include-all`, hay una migración anterior a la última
     registrada que falló o se salteó. Avisar a Facu antes de agregar el flag.
   - Si falla por drift (versiones registradas que no existen en el repo), no
     hay comando: se resuelve primero (ver `docs/db-baseline.md`).
   - Si Facu dice que una pendiente ya la corrió a mano, verificar en la base
     que esté (un RPC con la anon key responde `permission denied` si existe y
     `PGRST202` si no). Si la migración es idempotente (`CREATE OR REPLACE`,
     `IF NOT EXISTS`), el push la vuelve a correr y la registra. Si no lo es, el
     camino es `migration repair --status applied <versión>`, que también corre
     Facu.

4. **Pasar el comando** tal cual lo imprimió el script, en un bloque de código,
   con la lista de migraciones que aplica. Corre en un subshell, así no deja
   las credenciales exportadas en la terminal, y nombra la variable
   (`$STAGING_DB_URL`), no la URL. Aplica exactamente lo que mostró el
   dry-run, aunque después se mergee algo más a la rama.

5. **Verificar** cuando Facu avise que lo corrió: volver a correr el script.
   Tiene que decir "Nada pendiente". Si no, mostrar qué quedó y por qué.
