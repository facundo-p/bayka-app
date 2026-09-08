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

| Script              | Qué hace                       |
| ------------------- | ------------------------------ |
| `npm run dev`       | Servidor de desarrollo         |
| `npm run build`     | Typecheck + build de prod      |
| `npm run typecheck` | Solo typecheck                 |
| `npm run lint`      | ESLint                         |
| `npm test`          | Tests (Vitest)                 |
| `npm run audit:responsive` | Auditoría de layout en browser |

## Responsive

La escala de breakpoints del proyecto es **1400 / 1200 / 900 / 600** (más
`max-height: 760` para ventana baja), documentada en el bloque Layout de
`src/theme/theme.css`. Los valores van literales en cada `@media` porque `var()`
no se resuelve en el prelude de una at-rule; `src/theme/__tests__/breakpoints.test.ts`
falla si aparece otro número, otra unidad o la sintaxis de rango, y también exige
`minmax(0, …)` en los tracks flexibles.

Los bugs de layout no los ve ningún test: jsdom no evalúa layout. Para eso está
`npm run audit:responsive`, que recorre 9 pantallas × 9 anchos en Chromium y
reporta scroll horizontal, solapamientos, texto recortado, controles
inalcanzables, cards colapsadas y tablas que recortan en vez de scrollear.
Compara contra `scripts/auditoria.baseline.json` y sale con código 1 si algo
empeoró.

```sh
npx playwright install chromium   # una vez por máquina
npm run dev:demo                  # en otra terminal (llega con #353)
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
