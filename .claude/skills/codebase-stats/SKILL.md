---
name: codebase-stats
description: Mide la codebase por sector (mobile, web, supabase, scripts, contracts, tooling) y lenguaje — líneas de código/comentario/blanco, tamaño de archivos, funciones largas, hotspots, deuda, cobertura y duplicación — y republica el dashboard con la evolución entre corridas. Sirve para tener un overview, comparar antes y después de un refactor, o release contra release.
argument-hint: "[vs <ref>] | [backfill <ref>]"
disable-model-invocation: true
---

# /codebase-stats — radiografía de la codebase

Project root: `/Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-web-v1`

Artifact fijo: **https://claude.ai/artifact/P461PMDxyVZvxqwfUHZ3oX**

Todo lo mide `scripts/stats.mjs` leyendo git (`ls-tree` + `cat-file`), sin hacer
checkout. El JSON va directo al HTML: **no lo leas**. Lo que necesitás para
redactar los hallazgos está en el resumen que el script imprime por stdout.

Tres cosas que este skill cuida:

- **El historial no se recalcula.** Cada corrida sobre `HEAD` deja un snapshot en
  `.codebase-stats/history/` (gitignorado) y el dashboard grafica todos los que
  haya. Si una métrica nueva no existe en un snapshot viejo, queda como hueco.
- **Nada de esto va al repo.** Salidas intermedias en `.codebase-stats/out/`,
  también gitignorado.
- **El backfill es solo a pedido explícito** (`backfill <ref>`). Nunca lo
  propongas como paso automático para "completar" el historial.

## Argumentos

| Invocación | Qué hace |
|---|---|
| `/codebase-stats` | Mide `HEAD`, compara contra la corrida anterior |
| `/codebase-stats vs <ref>` | Además compara contra `<ref>` (tag, branch o sha): suma el delta por archivo |
| `/codebase-stats backfill <ref>` | Mide `<ref>` y lo guarda en el historial con la fecha de ese commit. Sin cobertura ni duplicación: miden el working tree |

## 1. Elegir los análisis opcionales

Preguntá con `AskUserQuestion`, `multiSelect: true`. Las métricas base (líneas,
tamaños, funciones, hotspots, deuda) se calculan siempre y cuestan ~2 s.

- **Cobertura** — corre jest (mobile) y vitest (web) con istanbul, ~1 min. Tests
  rotos no cortan la medición.
- **Duplicación** — jscpd sobre código de producción, ~10 s.
- **Revisión del modelo** — subagentes leen los hotspots y las funciones más
  largas buscando optimizaciones, queries caras y riesgos de seguridad. Es lo
  único que consume tokens de verdad.

En `backfill` no preguntes: solo corren las métricas base.

## 2. Medir

```sh
node .claude/skills/codebase-stats/scripts/stats.mjs \
  --payload .codebase-stats/out/payload.json \
  [--coverage] [--duplication] [--base <ref>]
```

Backfill: `--ref <ref> --save-as-history` (sin `--coverage` ni `--duplication`).

Si hay cambios sin commitear, avisá: las métricas base miden el último commit y
la cobertura/duplicación el working tree.

## 3. Hallazgos

Un hallazgo es algo que vale la pena mirar, con archivo y línea. Se escriben en
`.codebase-stats/out/findings.json`:

```json
[{ "severity": "alta|media|baja", "area": "Refactor|Performance|Queries|Seguridad|Tests|Duplicación",
   "sector": "mobile", "path": "mobile/src/…", "line": 40,
   "title": "Qué pasa, en una oración", "detail": "Por qué importa y qué haría" }]
```

**Siempre**, aunque no se haya pedido revisión: leé el resumen y anotá lo que se
salga de lo normal. Por ejemplo, un archivo que cruzó 800 líneas, una función
nueva en el top, un ratio de tests que cayó, deuda que subió respecto de la
corrida anterior, o archivos de producción grandes sin ningún test.

**Con revisión del modelo:** lanzá hasta 3 subagentes en paralelo, uno por foco,
cada uno con la lista de archivos del resumen (top hotspots + funciones más
largas + bloques duplicados, si los hay). Pediles que lean solo esos archivos y
devuelvan hallazgos en el formato de arriba, máximo 5 cada uno, sin
especulación sin evidencia en el código:

1. **Optimización y duplicación** — lógica repetida, renders o cálculos de más,
   funciones para partir.
2. **Queries caras** — drizzle en loops (N+1), selects sin filtro, migraciones con
   FKs sin índice, RLS con subqueries por fila.
3. **Seguridad** — secretos, RLS permisivas, edge functions sin chequeo de rol,
   datos de otra organización alcanzables.

Si un subagente encuentra algo fuera de su foco, que lo reporte igual.

## 4. Renderizar y publicar

```sh
node .claude/skills/codebase-stats/scripts/render.mjs \
  --payload .codebase-stats/out/payload.json \
  --findings .codebase-stats/out/findings.json \
  --out .codebase-stats/out/dashboard.html
```

`--findings` también guarda los hallazgos en el snapshot de esta corrida.

Publicá con el Artifact tool, `file_path` = `.codebase-stats/out/dashboard.html` y
`url` = el artifact fijo de arriba (sin `icon`: ya tiene uno).

## 5. Cerrar

Respondé con el link y 3 a 5 líneas de lo más relevante: el delta contra la
comparación y los hallazgos de severidad alta. Por cada hallazgo que valga la
pena, **ofrecé** abrir un Issue con `/issue` — no lo crees solo.

## Mantenimiento

- Sectores, buckets, marcadores de deuda y exclusiones: `scripts/lib/config.mjs`.
- Si agregás una métrica al snapshot, subí `SCHEMA_VERSION` y hacé que el
  dashboard la trate como opcional (`?.`): los snapshots viejos no la tienen.
- Tests: `node --test .claude/skills/codebase-stats/scripts/stats.test.mjs`.
