---
name: deploy
description: Release de Bayka a producción — calcula bumps semver por app (web/mobile) sobre origin/main..origin/staging, propone versiones + changelog, y con OK de Facu commitea el release en staging y abre el PR staging→main con Issue, board y CI verificado. NO mergea (eso es de Facu, a mano).
argument-hint: "[dry-run]"
disable-model-invocation: true
---

# /deploy — Release staging → main

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`

Arma el pase a producción: es el ÚNICO camino para abrir un PR `staging → main`.
El merge final lo hace Facu a mano; este skill prepara todo y verifica CI, nada más.

El modelo de versionado (versiones por app, tags, APK vs. OTA) es el de
CLAUDE.md, "Releases y versionado": este skill lo ejecuta, no lo redefine.

Este archivo es además la **única fuente** de dos cosas que comparte con
`/novedades`: las precondiciones comunes (paso 0) y el contrato de formato de
`CHANGELOG.md` y `NOVEDADES.md` (sección siguiente).

## Contrato de formato de CHANGELOG.md y NOVEDADES.md

Dos lectores automáticos dependen de este formato: `release-tags.yml` extrae de
`CHANGELOG.md` las notas de cada GitHub Release, anclado en los headers `## ` y
`### `, y la pantalla `/novedades` de la web lee `NOVEDADES.md`, horneado en el
build, con `web/src/lib/parsearNovedades.ts`. Si el formato cambia, se rompen.

Toda entrada nueva, publicada o pendiente, va inmediatamente después de la
intro del archivo, arriba de la última.

### Entrada publicada de `CHANGELOG.md`

Técnica, con `#N` linkeables:

```markdown
## <YYYY-MM-DD> · web X.Y.Z · mobile A.B.C

### Web X.Y.Z

#### Agregado
- <feat> (#N)

#### Corregido
- <fix> (#N)

### Mobile A.B.C (versionCode M)

#### Cambiado
- <refactor con impacto visible> (#N)

### Otros
- <DB / tooling / docs relevantes> (#N)
```

- `### Web X.Y.Z` y `### Mobile X.Y.Z (versionCode N)` son las anclas exactas
  que busca `release-tags.yml`: no cambiar su forma.
- Se omite la app que no participa; las categorías vacías no se escriben.
- Dos releases el mismo día: sufijo ` (2)` en el H2.

### Entrada publicada de `NOVEDADES.md`

Release notes comerciales para usuarios y clientes: solo lo que el usuario nota
(features y fixes visibles); infra, tooling, docs y DB **no aparecen**. Sin
`#N`, sin jerga interna (staging, RLS, back-merge, …), en voseo.

```markdown
## Web X.Y.Z · <D de mes de AAAA>

- **<Titular corto.>** <Qué puede hacer o qué mejora ve el usuario.>
```

- H2 solo con las apps que participan, `·` como separador; mismo sufijo ` (2)`
  si hay dos releases el mismo día.
- Si nada es visible, un único bullet: `- Mejoras internas y de estabilidad.`
  Tiene que ser un bullet: la pantalla ignora las líneas sueltas y mostraría la
  versión vacía.

### Sección pendiente (staging, #375)

Entre releases, `/novedades` acumula lo que entró a staging. `NOVEDADES.md`:

```markdown
## En pruebas · próxima versión
<!-- sincronizado-hasta: 5930146 #374 -->

- **Titular corto.** Qué puede hacer o qué mejora ve el usuario. <!-- #344 #350 -->
  - En la web de pruebas, entrá a Plantaciones y abrí una.
  - Tocá un árbol del listado.
  - Esperá ver: el detalle se abre a la derecha, sin tapar el listado.
```

`CHANGELOG.md`:

```markdown
## Sin publicar
<!-- sincronizado-hasta: 5930146 #374 -->

### Web

#### Agregado
- Detalle de árbol en panel lateral (#344, #350)

### Mobile

### Otros
- RLS por membresía (#318)
```

- **Marca** `sincronizado-hasta: <sha-corto> #<PR>`: el último commit
  first-parent de staging procesado. Va en la línea siguiente al `## ` y es
  **idéntica en los dos archivos**: así se sabe que están sincronizados.
- **Traza**: cada bullet de NOVEDADES termina en `<!-- #N #M -->` (la web no la
  muestra); cada bullet de CHANGELOG, en `(#N, #M)`. Todo ítem pendiente la
  tiene: es lo que permite saber qué ítems toca un PR nuevo.
- **Pasos**: sub-bullets indentados 2 espacios. El primero dice dónde probar
  (web de pruebas, o app **Bayka TEST**); el último arranca con "Esperá ver:".
  Wrap a 80 columnas con 4 espacios; una línea de continuación nunca empieza
  con `- ` (se leería como otro paso).
- El título de NOVEDADES empieza con **"En pruebas"**: es contrato con
  `TITULO_EN_PRUEBAS` de `parsearNovedades.ts`. Los `### Web` / `### Mobile`
  sin versión no chocan con `release-tags.yml` (busca `### Web X.Y.Z` exacto)
  y además la sección nunca llega a main.
- Redacción: la de las entradas publicadas de arriba, en cada archivo; las apps
  o categorías vacías se omiten.
- Si nada de lo pendiente es visible, NOVEDADES lleva un único bullet, sin traza
  ni pasos: `- Mejoras internas y de estabilidad. Por ahora no hay nada nuevo para probar.`

### Conversión de la sección pendiente en entrada publicada

La hace `/deploy` en el commit de release, así main nunca ve la sección
pendiente y el próximo `/novedades` arranca de cero desde `origin/main`:

- `CHANGELOG.md`: `## Sin publicar` → `## <YYYY-MM-DD> · web X.Y.Z · mobile A.B.C`;
  `### Web` → `### Web X.Y.Z`; `### Mobile` → `### Mobile A.B.C (versionCode M)`.
  Se borran la marca y las apps sin cambios.
- `NOVEDADES.md`: `## En pruebas · …` → `## Web X.Y.Z · <D de mes de AAAA>`. Se
  borran la marca, las trazas `<!-- #N -->` y todos los sub-bullets de pasos. El
  bullet de "nada visible" pasa al texto publicado: `- Mejoras internas y de estabilidad.`

### Verificación

Antes de cada commit que toque estos archivos:

```bash
(cd web && npx vitest run src/lib/__tests__/parsearNovedades.test.ts)
```

Lee el `NOVEDADES.md` real: toda entrada publicada con al menos un ítem, y la
sección en pruebas, si está, una sola y arriba de todo. Después de una
conversión, además, estos dos sin resultados:

```bash
grep -nE 'sincronizado-hasta|<!-- #|^## (Sin publicar|En pruebas)' NOVEDADES.md CHANGELOG.md
grep -n '^  - ' NOVEDADES.md
```

## 0. Precondiciones — abortar si falla alguna

Las comunes valen igual para `/novedades`:

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1
git status --porcelain          # debe estar vacío (working tree limpio)
git fetch origin --tags --prune

# ¿Ya hay un release en curso? Si devuelve algo: /deploy no crea otro (ver
# "Refrescar"); /novedades no sincroniza (lo nuevo lo concilia "Refrescar").
gh pr list --base main --head staging --state open --json number,title,url

# ¿main tiene commits propios (hotfix sin back-merge)? → si devuelve algo, STOP:
# pedir back-merge main→staging antes de seguir. El --no-merges es CLAVE:
# los merge commits de releases anteriores viven solo en main por diseño.
git log --no-merges --oneline origin/staging..origin/main
```

Solo `/deploy`: la versión ACTUAL de cada app debe estar taggeada y en main.

```bash
# Si falta un tag → hay un release a medias o abandonado: STOP y reportar
# (ver "Abortar un release en curso"). Si no existe NINGÚN tag web-v*/mobile-v*,
# faltan los tags baseline (#273) — crearlos primero.
WEB_VER="$(node -p "require('./web/package.json').version")"
MOB_VER="$(node -p "require('./mobile/app.json').expo.version")"
for t in "web-v${WEB_VER}" "mobile-v${MOB_VER}"; do
  git rev-parse -q --verify "refs/tags/$t" >/dev/null || echo "FALTA tag $t"
  git merge-base --is-ancestor "$t" origin/main 2>/dev/null || echo "OJO: $t no es ancestro de main"
done
```

## 1. Recolectar y clasificar cambios

El rango del release es **`origin/main..origin/staging`** — exactamente lo que
el PR va a mergear. Los tags NO definen el rango (solo el sanity check de arriba).

**Si `NOVEDADES.md`/`CHANGELOG.md` tienen sección pendiente** (#375): correr la
conciliación de `/novedades` en modo `completo` sobre este rango (sus pasos 1–4,
sin su commit) y usar el resultado como borrador de las dos entradas. Si la
marca `sincronizado-hasta` no era el último PR del rango, avisarlo en la
propuesta. Los bumps se siguen calculando por commits, como abajo.

```bash
RANGE="origin/main..origin/staging"
git rev-list --count $RANGE      # 0 → abortar: "staging y main están al día"

# PRs mergeados (para el resumen del PR de release):
git log --merges --first-parent --pretty='%h %s' $RANGE
# Clasificación por paths (un commit que toca ambas apps cuenta para ambas):
git log --no-merges --pretty='%h|%s' $RANGE -- web/
git log --no-merges --pretty='%h|%s' $RANGE -- mobile/
git log --no-merges --pretty='%h|%s' $RANGE -- . ':(exclude)web' ':(exclude)mobile'
# Breaking changes declarados en el body:
git log --no-merges --pretty='%h %s%n%b--END--' $RANGE | grep -B3 'BREAKING CHANGE' || true
```

**Los paths deciden, el scope refuerza**: si un `feat(web):` solo tocó
`mobile/**`, se clasifica como mobile y la inconsistencia se lista en la
propuesta para que Facu la vea.

## 2. Calcular bumps (semver por app)

Sobre los subjects de la lista de cada app:

| Tipo de commit | Bump |
|---|---|
| `!` tras el tipo/scope, o `BREAKING CHANGE` en el body | major |
| `feat` | minor |
| `fix`, `perf` | patch |
| `docs`, `chore`, `style`, `refactor`, `test`, `build`, `ci` | no bumpea |
| Subject que no matchea conventional commits | patch + aviso en la propuesta |

Gana el bump más alto de la lista. Reglas extra:
- `supabase/**` y demás paths fuera de `web/`/`mobile/` → sección `### Otros`
  del changelog; **no bumpean ninguna app por sí solos**.
- `versionCode` de mobile: **+1 solo si mobile bumpea**.

## 3. Proponer y ESPERAR el OK

Mostrar a Facu: versiones actuales → nuevas por app, el borrador COMPLETO de
las DOS entradas —la técnica de `CHANGELOG.md` y la pública de `NOVEDADES.md`
(#279), con el formato del contrato— y las inconsistencias detectadas. Con
secciones pendientes, los borradores son esas secciones conciliadas y ya
convertidas.
**No tocar ningún archivo sin OK explícito.** Si el argumento fue `dry-run`,
terminar acá.

## 4. Commit de release (recién con el OK)

```bash
git switch staging && git pull --ff-only origin staging
(cd web && npm version "X.Y.Z" --no-git-tag-version)      # actualiza package-lock también
(cd mobile && npm version "A.B.C" --no-git-tag-version)   # espejo de app.json
# mobile/app.json: editar expo.version = "A.B.C" y expo.android.versionCode += 1
# CHANGELOG.md y NOVEDADES.md: insertar las entradas aprobadas, o convertir las
# secciones pendientes (contrato, "Conversión")
# Correr la "Verificación" del contrato, greps incluidos: si falla, no commitear
git add CHANGELOG.md NOVEDADES.md web/package.json web/package-lock.json \
        mobile/app.json mobile/package.json mobile/package-lock.json
git commit -m "chore(release): web vX.Y.Z, mobile vA.B.C (#<issue>)"
git push origin staging
```

Saltear el `npm version`/edición de la app que no bumpea. Este push directo a
staging es la excepción documentada en CLAUDE.md: commit mecánico, generado con
OK previo, y revisado dentro del diff del PR de release. El CI de ese PR corre
los tests de la web, que leen el `NOVEDADES.md` real: la verificación de arriba
evita enterarse recién ahí.

## 5. Issue + PR + board

```bash
gh issue create --title "Release <YYYY-MM-DD>: web vX.Y.Z · mobile vA.B.C" \
  --body-file <borrador: changelog de la entrada + contexto>
gh pr create --base main --head staging \
  --title "Release: web vX.Y.Z · mobile vA.B.C" --body-file <body>
gh project item-add 1 --owner facundo-p --url <url-issue>
gh project item-add 1 --owner facundo-p --url <url-pr>
ITEM_ID="$(gh project item-list 1 --owner facundo-p --format json \
  | jq -r '.items[] | select(.content.url == "<url-pr>") | .id')"
gh project item-edit --id "$ITEM_ID" --project-id PVT_kwHOAlH2RM4BPDWt \
  --field-id PVTSSF_lAHOAlH2RM4BPDWtzg9kyak --single-select-option-id 82eeff6d  # PR en review
```

Body del PR: `Closes #<issue>` + resumen de PRs incluidos + las entradas de
changelog (técnica y pública) + este checklist post-merge (literal, es para
Facu):

```markdown
## Post-merge (manual)
- [ ] Workflow release-tags verde: `gh run list --workflow=release-tags.yml -L 1`
      → debe crear web-vX.Y.Z / mobile-vA.B.C (tag + GitHub Release)
- [ ] Cerrar este Issue a mano: `gh issue close <issue>` — `Closes #N` NO cierra
      en PRs a main (el default branch es staging)
- [ ] Mover Issue y PR a "En prod" en el board (option id 033672b0)
- [ ] Si mobile bumpeó: buildear APK prod desde main (/build-apk-local prod) y
      distribuirlo a los dispositivos
- [ ] Si el release incluye migraciones supabase/**: aplicarlas a prod con
      confirmación dedicada (CLAUDE.md, "Flujo de branches")
- [ ] Regla mientras este PR estuvo/esté abierto: NO mergear nada más a staging
```

## 6. Verificar CI y terminar

```bash
gh pr checks <numero-pr> --watch    # correr con run_in_background y timeout amplio
```

- **Verde** → reportar "PR de release listo para tu merge" con el link. FIN: el
  merge es de Facu, a mano. No mergear, no aprobar, no tocar más staging.
- **Rojo** → reportar el check fallido y PARAR. No arreglar en caliente sin un
  nuevo OK (el fix entra por el flujo normal de PR a staging, y después se
  refresca el release).

## Refrescar un release abierto

Si staging avanzó con el PR de release abierto (no debería — regla en
CLAUDE.md), o hubo que meter un fix: recalcular todo sobre el staging actual
(pasos 1–3) y, con OK, pushear a staging UN commit que corrija versión +
changelog (`chore(release): ajusta release a web vX.Y.Z', ...`), pasando antes
la "Verificación" del contrato. El PR existente se actualiza solo (trackea el
HEAD de staging). Editar título/body del PR e Issue para reflejar las versiones
nuevas. Los PRs que entraron después del commit de release se concilian con las
reglas del paso 4 de `/novedades` directamente sobre las entradas del release;
no se recrea la sección pendiente.

## Abortar un release en curso

```bash
gh pr close <numero-pr> --comment "Release abortado: <motivo>"
gh issue close <numero-issue> --comment "Release abortado: <motivo>"
git switch staging && git pull --ff-only origin staging
git revert --no-edit <sha-del-commit-de-release> && git push origin staging
```

Sin el revert, el próximo `/deploy` encuentra versión bumpeada sin tag (sanity
check del paso 0) y se rehúsa a apilar otro bump encima.

## Edge cases

| Caso | Comportamiento |
|---|---|
| Una app sin cambios | No se bumpea ni aparece en la entrada; el release sale igual para la otra (el workflow saltea el tag existente) |
| `git rev-list --count` da 0 | Abortar: "staging y main están al día" |
| Hay cambios pero ningún bump (solo docs/chore/DB) | Preguntar a Facu; con OK → release "sin versiones": entrada solo con `### Otros`, sin bumps ni tags (el merge igual deploya la web y habilita migraciones) |
| No existe ningún tag `web-v*`/`mobile-v*` | Faltan los tags baseline (#273): crearlos sobre origin/main y volver a empezar |
| `origin/staging..origin/main` con commits (`--no-merges`) | STOP: hotfix sin back-merge. El PR de hotfix a main lleva su propio bump patch + entrada de changelog (el workflow lo taggea al mergear); después back-merge main→staging inmediato |
| PR de release ya abierto | No crear otro: "Refrescar" o abortar. El commit de refresh incluye **CHANGELOG.md y NOVEDADES.md**, no solo los bumps |
| Sección pendiente desactualizada o con marcas distintas | La conciliación en modo `completo` del paso 1 la pone al día; avisar el desync en la propuesta |
| Sin sección pendiente | Derivar las dos entradas de los commits, como siempre |
