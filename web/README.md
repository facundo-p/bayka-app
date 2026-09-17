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
| `npm run lint`             | ESLint de web y de `scripts/` de la raíz  |
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

El cliente falso siempre devuelve sesión, así que `/login` redirige al listado y
no se puede ver. Con **`?sinSesion=1`** arranca sin sesión: es la única forma de
mirar el login acá.

Cubre las tres pantallas de Organización y el detalle de cada plantación.

Los datos están en `src/demo/datos.ts`, una tabla por clave. Para cubrir una
pantalla nueva, agregá su tabla ahí. El cliente falso (`src/demo/supabase.ts`)
resuelve las consultas de la web contra esas tablas: filtros reales, embebidos
(`groups!inner(...)`, anidados), `.or()`, `limit`/`range` y `count`. Un operador
que no simula tira un error, en vez de devolver todo sin filtrar. Nada de esto
entra al bundle de producción: el reemplazo lo hace un alias de
`vite.demo.config.ts`.

Los árboles tienen dos escalas a propósito. La matriz `ARBOLES_POR_PLANTACION`
da los totales de las tarjetas y de Especies (18.442 árboles). El explorador de
Datos, el dashboard y el mapa listan pocas filas de muestra por plantación, y
los conteos por parcela se hacen sobre esas filas, así cada parcela suma lo
mismo que sus grupos.

## Responsive

El criterio, los patrones y las decisiones están en
[docs/responsive-web.md](../docs/responsive-web.md). Acá va sólo cómo se corre
la verificación.

La escala de breakpoints del proyecto es **1400 / 1200 / 900 / 600** (más
`max-height: 760` para ventana baja). Los números viven en
`src/theme/breakpoints.json`, que leen `useMediaQuery` (`BP`), el test de abajo y
los anchos de la auditoría; el porqué de cada escalón está en el bloque Layout de
`src/theme/theme.css`. En CSS los valores van literales en cada `@media` porque
`var()` no se resuelve en el prelude de una at-rule; `src/theme/__tests__/breakpoints.test.ts`
falla si aparece otro número, otra unidad o la sintaxis de rango, y también exige
`minmax(0, …)` en los tracks flexibles.

Los bugs de layout los busca la auditoría en Chromium. Qué mide, por qué no
corre en CI y qué no ve: [docs/responsive-web.md](../docs/responsive-web.md#cómo-se-verifica).
Corrélo cuando toques layout y pegá la matriz en el PR.

```sh
npx playwright install chromium          # una vez por máquina
npm run dev:demo                         # en otra terminal
npm run audit:responsive                 # matriz; sale con 1 si algo empeoró contra el baseline
npm run audit:responsive -- --autotest   # que los checks disparen y cada fila mida lo que dice
npm run audit:responsive -- --baseline   # regraba scripts/auditoria/baseline.json
npm run audit:responsive -- --capturas   # además escribe PNGs en .auditoria/
BASE_URL=http://localhost:4173 npm run audit:responsive   # contra otro servidor
```

En pantalla de teléfono las tablas sueltan sus columnas secundarias. La marca
vive en la columna (`fueraEnMovil` en `TableColumn`), no en una lista de claves
aparte que se pueda desincronizar, y la aplica `useColumnasVisibles`. Se filtra
el array y no se esconden las celdas por CSS: esconder `<td>` por `nth-child`
obliga a esconder el `<th>` por el mismo índice, y el día que alguien inserte
una columna en el medio los dos se desalinean en silencio. Dos reglas duras, con
test propio: nunca se cae la columna de identidad ni la de acciones.

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
