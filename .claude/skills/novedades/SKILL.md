---
name: novedades
description: Sincroniza la sección "En pruebas" de NOVEDADES.md y "Sin publicar" de CHANGELOG.md con lo que entró a staging desde la última sincronización — concilia PRs que alteran o quitan cambios anteriores, redacta pasos de prueba por ítem y, con OK de Facu, commitea y pushea a staging.
argument-hint: "[dry-run] [completo]"
disable-model-invocation: true
---

# /novedades — lo que está en staging y todavía no en prod

Quien prueba staging entra a `/novedades` en la web de pruebas
(`https://staging.bayka-app.pages.dev/novedades`) y ve qué entró desde el último
pase a producción, con los pasos para probar cada cosa. Este skill mantiene esa
sección al día; `/deploy` después la convierte en la entrada de la versión (#375).

- `/novedades` — después de mergear uno o varios PRs a staging.
- `/novedades dry-run` — propone sin tocar nada.
- `/novedades completo` — ignora la marca y reconstruye desde `origin/main`
  (antes de un release, o si algo huele raro).

La regla que manda todo lo demás: **la sección describe `origin/staging` como
está hoy**, no la historia de cómo se llegó. Nunca pedir que se pruebe algo
que ya no existe, o que no existe como se hizo en un principio.

## Contrato de formato

Vive en `.claude/skills/deploy/SKILL.md`, "Contrato de formato de CHANGELOG.md
y NOVEDADES.md": leerlo antes de redactar. Acá importa sobre todo "Sección
pendiente" (marca, traza, pasos, el caso "nada visible") y la redacción de las
entradas publicadas, que es la misma.

## 0. Precondiciones — abortar si falla alguna

Las comunes del paso 0 de `/deploy` (working tree limpio, `fetch`, PR de release
abierto, hotfix sin back-merge); el sanity check de tags es solo de `/deploy`.
Con un PR de release abierto, STOP: no se sincroniza, lo nuevo lo concilia
`/deploy` "Refrescar".

Todo lo que sigue se lee de `origin/staging` (`git show origin/staging:NOVEDADES.md`,
`git grep … origin/staging`), no del working tree ni del staging local, que
puede estar viejo.

## 1. Base del rango

Leer la marca de los dos archivos en `origin/staging`
(`grep -o 'sincronizado-hasta: [0-9a-f]*'`) y decidir:

| Situación | Base | Modo |
|---|---|---|
| Argumento `completo` | `origin/main` | completo |
| No hay sección pendiente | `origin/main` | completo |
| Las marcas de los dos archivos difieren | `origin/main` | completo, avisando el desync |
| `git merge-base --is-ancestor $MARCA origin/staging` falla | `origin/main` | completo, avisando que la historia cambió |
| `git merge-base --is-ancestor $MARCA origin/main` da OK | — | STOP: hubo un release y la sección sobrevivió; `/deploy` debió convertirla. Reportar |
| Resto | `$MARCA` | incremental |

## 2. PRs nuevos

```bash
git log --first-parent --pretty='%h %s' $BASE..origin/staging
```

- `Merge pull request #N …` → PR #N. Un commit normal que termina en `(#N)`
  es un PR mergeado con squash → PR #N.
- `chore(release): …` y `docs(novedades): …` se ignoran.
- Cero PRs → "al día hasta <marca>", FIN.

Por PR: `gh pr view N --json title,body,files,closingIssuesReferences`.

## 3. Análisis por PR

Hasta 5 PRs, en el contexto principal. Con más, **subagentes en paralelo**, un
lote de PRs de la misma área por agente. Cada uno devuelve por PR:

- **Clase**: `visible-web` · `visible-mobile` · `solo-entorno-pruebas` · `interno`.
  Los paths deciden (como en `/deploy`); `test`, `docs`, `chore` y `refactor`
  sin efecto visible son `interno`. Lo que solo se ve con el entorno de pruebas
  (el banner, la etiqueta de build) es `solo-entorno-pruebas` → solo CHANGELOG.
  DB/RLS/seguridad → `### Otros`, y a NOVEDADES solo si el usuario nota el efecto.
- **Qué nota el usuario**, en una o dos frases.
- **Evidencia** en `origin/staging`: `archivo:línea` de la ruta, el componente o
  el texto de UI que lo demuestra.
- **Pasos**: dónde → qué hacer → "Esperá ver: …".
- **Relaciones**: qué PRs del rango toca o modifica (archivos en común, lo que
  dice el body, el Issue que cierra).

## 4. Conciliación — el núcleo

Un PR nuevo **afecta** a un ítem pendiente si:
(a) comparte archivos no-test con los PRs de su traza (`gh pr view <traza> --json files`),
(b) su título, body o Issue los menciona, o
(c) es un revert.

Cada ítem afectado se **re-deriva del diff neto** — no se le apila un parche:

```bash
git diff origin/main origin/staging -- <archivos de la traza + los del PR nuevo>
```

más la lectura del código actual. Resultado: se mantiene, se reescribe
(traza += #N), se parte en dos, o **se borra** (el diff neto ya no muestra un
cambio visible respecto de prod). Un PR visible que no afecta a nada es un
ítem nuevo.

Reglas de fondo:

- **Un fix de algo que todavía no llegó a prod no es novedad**: se funde en el
  ítem original (traza += #N), también en CHANGELOG. Nadie vio ese bug en prod.
- Un fix de algo que **sí** está en prod es un ítem "Corregido" propio.
- Cambiar algo de prod es "Cambiado", contado como se ve ahora ("ahora…").
- Un ítem nunca describe un estado intermedio: si #356 quitó los chips que
  había agregado #344, el ítem no los menciona.

**Gate final, siempre (también en incremental)**: para **cada** ítem pendiente,
no solo los tocados, confirmar que su evidencia sigue en `origin/staging`:

```bash
git grep -n '<texto de UI o ruta>' origin/staging -- web mobile
```

Sin evidencia → proponer borrarlo o reescribirlo. Es la red contra las
reversiones que la heurística de archivos no ve.

## 5. Proponer y ESPERAR el OK

Mostrar a Facu:

- rango procesado (base → punta, modo incremental o completo) y cada PR nuevo
  con su clase;
- qué pasó con cada ítem: Nuevo · Reescrito por #X · Fundido en «…» ·
  Eliminado: #X lo quitó · Sin evidencia · Sin cambios;
- las dos secciones completas como quedarían;
- ítems mobile: recordar que la app TEST tiene que tener el cambio (APK TEST
  nuevo o `push-update-apk`) para que se puedan probar.

**No tocar ningún archivo sin OK explícito.** Con `dry-run`, terminar acá.

## 6. Commit (recién con el OK)

```bash
git switch staging && git pull --ff-only origin staging
# NOVEDADES.md y CHANGELOG.md: reemplazar la sección pendiente entera (o crearla
# después de la intro), con la misma marca en los dos
# Correr la "Verificación" del contrato: el vitest, no los greps de conversión
git add NOVEDADES.md CHANGELOG.md
git commit -m "docs(novedades): sincroniza pendientes hasta #N"
git push origin staging
```

Push directo a staging: es la excepción documentada en CLAUDE.md, y solo vale
para estos dos archivos, con OK previo. Si el push se rechaza porque staging
avanzó: `git pull --ff-only` y volver al paso 2 con los PRs nuevos. Nunca forzar.

Cerrar con el link `https://staging.bayka-app.pages.dev/novedades`: se ve
cuando termina el build de Pages, y el aviso del sidebar se re-enciende solo.

## Edge cases

| Caso | Comportamiento |
|---|---|
| PR de release abierto | STOP. `/deploy` "Refrescar" concilia lo nuevo sobre las entradas del release |
| Sin PRs nuevos | "Al día hasta <marca>", sin commit |
| Todo lo nuevo es interno | Se actualizan CHANGELOG y la marca; NOVEDADES solo cambia la marca |
| Marcas distintas entre archivos | Modo completo, avisando el desync |
| Un revert | Afecta a los ítems del PR revertido; casi siempre los borra |
| PR que toca web y mobile | Un ítem por lo que nota cada usuario; los pasos dicen dónde |
| Push rechazado | `pull --ff-only` y reprocesar; nunca `--force` |
