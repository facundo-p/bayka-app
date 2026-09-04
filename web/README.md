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
