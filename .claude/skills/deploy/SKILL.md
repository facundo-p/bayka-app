---
name: deploy
description: Release de Bayka a producción — calcula bumps semver por app (web/mobile) sobre origin/main..origin/staging, propone versiones + changelog, y con OK de Facu commitea el release en staging y abre el PR staging→main con Issue, board y CI verificado. NO mergea (eso es de Facu, a mano).
argument-hint: "[dry-run]"
disable-model-invocation: true
---

# /deploy — Release staging → main

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`

Arma el pase a producción: es el ÚNICO camino para abrir un PR `staging → main`
(CLAUDE.md, "Releases y versionado"). El merge final lo hace Facu a mano; este
skill prepara todo y verifica CI, nada más.

## Modelo de versionado (resumen)

- **Versiones separadas por app.** Fuentes de verdad: `web/package.json` y
  `mobile/app.json` (`expo.version` + `expo.android.versionCode`).
  `mobile/package.json` se mantiene espejo de `app.json`. El `package.json` de
  la raíz está congelado en 1.0.0 y NO se toca jamás.
- Tags `web-vX.Y.Z` / `mobile-vX.Y.Z` + GitHub Releases: los crea el workflow
  `release-tags.yml` al mergear a main, con notas extraídas de `CHANGELOG.md`.
- Release con cambios mobile ⇒ APK nuevo (versionCode +1). OTA
  (`push-update-apk`) solo para hotfixes DENTRO de una versión ya instalada.

## 0. Precondiciones — abortar si falla alguna

```bash
cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1
git status --porcelain          # debe estar vacío (working tree limpio)
git fetch origin --tags --prune

# ¿Ya hay un release en curso? → si devuelve algo, NO crear otro: ver "Refrescar"
gh pr list --base main --head staging --state open --json number,title,url

# ¿main tiene commits propios (hotfix sin back-merge)? → si devuelve algo, STOP:
# pedir back-merge main→staging antes del release. El --no-merges es CLAVE:
# los merge commits de releases anteriores viven solo en main por diseño.
git log --no-merges --oneline origin/staging..origin/main

# Sanity check: la versión ACTUAL de cada app debe estar taggeada y en main.
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
las DOS entradas de changelog — la técnica de `CHANGELOG.md` (formato de abajo)
y la pública de `NOVEDADES.md` (#279) — y las inconsistencias detectadas.
**No tocar ningún archivo sin OK explícito.** Si el argumento fue `dry-run`,
terminar acá.

Formato de la entrada (las anclas `### ` son parseadas por `release-tags.yml` —
no cambiar su forma; ver cabecera de `CHANGELOG.md`):

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

Se omite la app que no participa; categorías vacías no se escriben. Si hay dos
releases el mismo día, sufijo ` (2)` en el H2. La entrada nueva va inmediatamente
después del bloque de intro, arriba de la última.

Entrada pública de `NOVEDADES.md` (#279): redacción de release notes
comerciales, para usuarios/clientes. Solo cambios que el usuario nota (features
y fixes visibles); infra, tooling, docs y DB **no aparecen**. Sin `#N`, sin
jerga interna (staging, RLS, back-merge, …), en voseo. Si ninguna app tiene
cambios visibles, la entrada es una sola línea: "Mejoras internas y de
estabilidad". Formato:

```markdown
## Web X.Y.Z · <D de mes de AAAA>

- **<Titular corto.>** <Qué puede hacer o qué mejora ve el usuario.>
```

(H2 solo con las apps que participan, `·` como separador; misma regla de
sufijo ` (2)` si hay dos releases el mismo día. La entrada va después de la
intro, arriba de la última. Ningún workflow parsea este archivo.)

## 4. Commit de release (recién con el OK)

```bash
git switch staging && git pull --ff-only origin staging
(cd web && npm version "X.Y.Z" --no-git-tag-version)      # actualiza package-lock también
(cd mobile && npm version "A.B.C" --no-git-tag-version)   # espejo de app.json
# mobile/app.json: editar expo.version = "A.B.C" y expo.android.versionCode += 1
# CHANGELOG.md y NOVEDADES.md: insertar las entradas aprobadas
git add CHANGELOG.md NOVEDADES.md web/package.json web/package-lock.json \
        mobile/app.json mobile/package.json mobile/package-lock.json
git commit -m "chore(release): web vX.Y.Z, mobile vA.B.C (#<issue>)"
git push origin staging
```

Saltear el `npm version`/edición de la app que no bumpea. Este push directo a
staging es la excepción documentada en CLAUDE.md: commit mecánico, generado con
OK previo, y revisado dentro del diff del PR de release.

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
changelog (`chore(release): ajusta release a web vX.Y.Z', ...`). El PR existente
se actualiza solo (trackea el HEAD de staging). Editar título/body del PR e
Issue para reflejar las versiones nuevas.

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
| PR de release ya abierto | No crear otro: "Refrescar" o abortar |
