# Bayka Gestión (web)

Sitio web de gestión de plantaciones para perfiles **admin** y **superadmin**.
Convive con la app de campo (`mobile/`) sobre el mismo proyecto Supabase: la web
crea y configura plantaciones; la app registra árboles en campo.

Las decisiones de diseño y alcance están en
[ASUMPCIONES_Y_SUPUESTOS.md](./ASUMPCIONES_Y_SUPUESTOS.md).

## Stack

- Vite + React 19 + TypeScript estricto (SPA estática, sin backend propio).
- `@supabase/supabase-js` + TanStack Query (RLS de Postgres como autorización).
- `react-router` v7 (modo librería) · Recharts (gráficos).
- CSS Modules + tokens de marca en `src/theme/theme.css` (cero estilos inline,
  cero colores hardcodeados fuera del tema).
- Vitest + Testing Library.

## Requisitos

- **Node 22 LTS** (v25 está roto para builds en este repo).

## Setup

```bash
cd web
cp .env.example .env   # valores reales: mobile/eas.json (mismo Supabase que mobile)
npm install
npm run dev
```

El banner **"ENTORNO DE PRUEBAS · vX.Y.Z · <commit>"** (#287, #321) se muestra siempre salvo que el
build corra con `CF_PAGES_BRANCH=main` (entorno Production de Cloudflare Pages):
`npm run dev`, un `npm run build` local y los previews de cualquier otra branch lo
muestran. Para ver el build de prod: `CF_PAGES_BRANCH=main npm run build`.

El commit corto identifica el build que se está probando (la versión no: la
bumpea `/deploy` recién al pasar a `main`). Sale de `CF_PAGES_COMMIT_SHA` en
Pages y de `git rev-parse` en dev/CI, con sufijo `-dirty` si el árbol tenía
cambios sin commitear.

## Scripts

| Script                     | Qué hace                                  |
| -------------------------- | ----------------------------------------- |
| `npm run dev`              | Servidor de desarrollo                    |
| `npm run dev:demo`         | Igual, con datos de mentira y sin backend |
| `npm run build`            | Typecheck + build de prod                 |
| `npm run typecheck`        | Solo typecheck                            |
| `npm run lint`             | ESLint                                    |
| `npm test`                 | Tests (Vitest)                            |
| `npm run audit:responsive` | Auditoría de layout en browser            |

## Modo demo (sin backend)

```bash
npm run dev:demo      # http://localhost:5199
```

Levanta la app con un cliente Supabase falso (`src/demo/`) en lugar del real:
sin login, sin red y con datos verosímiles. Sirve para dos cosas que el servidor
normal no cubre:

- **Revisar layout y fidelidad visual.** Los tests no ven que una etiqueta se
  parta en dos renglones, que una fecha salga mal formateada o que una toolbar
  empuje scroll horizontal. Con anchos de columna y conteos reales, sí se ve.
- **Mostrar la app sin tocar datos reales** ni depender de staging.

El banner de entorno de pruebas viene prendido a propósito: nada de lo que se ve
ahí es real. `DEMO_BANNER=0 npm run dev:demo` lo apaga, para medir una pantalla
sin los 26px de la franja.

Cubre las tres pantallas de Organización y el detalle de plantación (parcelas,
grupos y 30 árboles con GPS y fotos en distintos estados).

Los datos están en `src/demo/datos.ts`, una tabla por clave. Para cubrir una
pantalla nueva, agregá su tabla ahí. El cliente falso (`src/demo/supabase.ts`)
solo simula lo que la web usa: el constructor de consultas encadenable, los
`count`, `rpc` y `auth`. Los filtros que no son `eq` se ignoran, y los `eq` sobre
columnas que los datos no modelan (los embebidos tipo `groups.plantation_id`)
también — con datos de mentira alcanza. Nada de esto entra al bundle de
producción: el reemplazo lo hace un alias de `vite.demo.config.ts`.

## Responsive

La escala de breakpoints del proyecto es **1400 / 1200 / 900 / 600** (más
`max-height: 760` para ventana baja), documentada en el bloque Layout de
`src/theme/theme.css`. Los valores van literales en cada `@media` porque `var()`
no se resuelve en el prelude de una at-rule; `src/theme/__tests__/breakpoints.test.ts`
falla si aparece otro número, otra unidad o la sintaxis de rango, y también exige
`minmax(0, …)` en los tracks flexibles.

Los bugs de layout no los ve ningún test: jsdom no evalúa layout, así que todos
los `getBoundingClientRect` dan cero. Para eso está `npm run audit:responsive`,
que recorre 9 pantallas × 9 anchos en Chromium y reporta scroll horizontal,
solapamientos, texto recortado, controles inalcanzables, cards colapsadas,
tablas que recortan en vez de scrollear y pantallas que no renderizaron nada.
Compara contra `scripts/auditoria.baseline.json` y sale con código 1 si algo
empeoró.

**Corrélo a mano cuando toques layout: no está en CI**, y es una decisión, no un
olvido. Necesita un Chromium y el servidor demo levantado, y el trabajo que
cubre —CSS de layout— es el que menos cambia. Con eso, el baseline vale lo que
valga la disciplina de correrlo: si tocaste un `@media`, una grilla, un `flex` o
un alto de card, corrélo antes de abrir el PR y pegá la matriz ahí. Si querés
volver sobre esto, la conversación es #359.

El baseline versiona **solo las métricas duras distintas de cero**: una celda
limpia es `{}` y lo único que se lee en el archivo son los defectos conocidos
que faltan arreglar. El informe completo —el detalle de cada defecto y el
tamaño de cada card— sale por pantalla en cada corrida; guardarlo eran 2400
líneas de output generado donde cualquier píxel producía diff.

```sh
npx playwright install chromium   # una vez por máquina
npm run dev:demo                  # en otra terminal
npm run audit:responsive
npm run audit:responsive -- --autotest   # verifica que los checks disparen
npm run audit:responsive -- --baseline   # regraba el baseline
npm run audit:responsive -- --capturas   # además escribe PNGs en .auditoria/
```

`--autotest` existe porque un check que no puede disparar reporta cero y hace
parecer que la app está impecable: le inyecta a una pantalla limpia cada defecto
que dice cazar y exige que lo reporte, y que calle sin él.

## Estructura (espejo de mobile)

```
src/
  components/    UI compartida (Button, Table, Modal, …) con su .module.css
  screens/       Pantallas (login, plantaciones, dashboard, …)
  queries/       Lecturas/agregaciones (sin SQL en pantallas)
  repositories/  Mutaciones por entidad
  services/      Lógica de negocio que coordina repos/queries
  hooks/         Puentes react (sin queries raw)
  lib/           Cliente supabase, constantes (PG_ERROR), helpers
  theme/         theme.css con los tokens de marca
```

Reglas heredadas del proyecto: separación datos/presentación obligatoria,
sin magic constants (SQLSTATE → `PG_ERROR`, enforced por eslint), estados de
dominio en español (`activa`/`finalizada`).
