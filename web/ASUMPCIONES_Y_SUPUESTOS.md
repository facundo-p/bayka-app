# Asumpciones y supuestos — Web de gestión Bayka (v1)

Documento vivo: registra todas las decisiones tomadas de forma autónoma durante el
milestone [Web de gestión (v1)](https://github.com/facundo-p/bayka-app/milestone/2),
para que puedan revisarse y revertirse con contexto. Cada PR que tome una decisión
nueva la agrega acá.

## 1. Alcance y producto

- **A1 — Nombre y ubicación.** El proyecto se llama "Bayka Gestión" y vive en la
  carpeta `web/`, hermana de `mobile/`, como segundo paquete independiente del
  monorepo (no hay npm workspaces; cada paquete maneja sus dependencias).
- **A2 — Audiencia.** Herramienta interna de gestión: pocos usuarios, desktop-first.
  Se garantiza usabilidad básica en pantallas angostas pero no se optimiza mobile
  (para campo existe la Bayka App).
- **A3 — Idioma.** Toda la UI, código de dominio y documentación en español,
  siguiendo la convención del proyecto (estados `activa`/`finalizada`, etc.).
  Sin i18n en v1.
- **A4 — Se adopta el rol `superadmin`** (el pedido decía "evaluar"). Decisión:
  - `superadmin`: acceso total a la web, incluida la gestión de usuarios y roles.
  - `admin`: toda la web salvo gestión de usuarios.
  - `tecnico`: sin acceso a la web (pantalla "sin acceso").
  Razón: la gestión de roles es destructiva (puede dejar a alguien sin acceso) y
  conviene restringirla más que la operatoria diaria de plantaciones.
- **A5 — ~~Sin alta de usuarios en v1~~ (SUPERADA por la épica #224).** El alta,
  la baja reversible y el cambio de contraseña/email ahora pasan por la edge
  function `admin-users` (service_role en el server, nunca en el cliente). El
  alta es por invitación: el usuario define su contraseña vía email en
  `/establecer-password`. Sigue vigente que la web con anon key no toca la Auth
  Admin API directamente.
- **A5b — Identificador secundario en el listado de usuarios: email.** Con
  `profiles.email` (migración 026) el email reemplaza a la organización como
  segunda línea de la celda de usuario; la organización queda como fallback
  para perfiles sin backfill.

## 2. Stack técnico

- **A6 — SPA estática: Vite + React 19 + TypeScript estricto.** Sin SSR/Next:
  es una herramienta interna autenticada (el SEO no aplica) y una SPA estática
  simplifica build y hosting. React 19 para alinear con mobile.
- **A7 — Acceso a datos directo con `@supabase/supabase-js`** (misma versión que
  mobile) + **TanStack Query v5** para caché/estado de servidor. No hay backend
  propio: la autorización la garantiza RLS en Postgres, igual que para mobile.
- **A8 — Router:** `react-router` v7 en modo librería (declarativo).
- **A9 — Gráficos:** Recharts (declarativo, liviano, paleta parametrizable desde
  el tema).
- **A10 — Estilos: CSS Modules + tokens en CSS custom properties**
  (`src/theme/theme.css`). Es el equivalente web de la regla `.styles.ts` de
  mobile: cero estilos inline, cero hex/px hardcodeados fuera del tema, regla de
  un solo lugar. No se usa Tailwind ni CSS-in-JS para no introducir un tercer
  paradigma de estilos en el repo.
- **A11 — Tests: Vitest + Testing Library.** Queries/repositories/servicios se
  testean unitariamente con supabase-js mockeado; componentes con tests de
  render. Sin E2E en v1.
- **A12 — Node 22 LTS** requerido (v25 está roto para builds en este repo,
  lección ya registrada en mobile).

## 3. Identidad visual

- **A13 — Colores del Manual de Identidad Corporativa (feb 2023):** azul
  `#0A3760` (primario) y verde oliva `#99B95B` (secundario), más la escala de
  derivados ya consolidada en `mobile/src/theme.ts`, que se replica como tokens
  CSS para mantener coherencia visual entre app y web.
- **A14 — Tipografías:** Linux Biolinum (títulos — fuente corporativa del manual,
  archivos copiados de `mobile/assets/fonts/`) y Poppins (cuerpo). El manual pide
  Meta Plus Normal Roman para bajadas, pero es una fuente comercial sin licencia
  web en el proyecto; mobile ya estableció Poppins como sustituto y la web hereda
  esa decisión.
- **A15 — Logo.** El isologotipo (agutí + BAYKA) se usa en login y sidebar en su
  versión monotono azul o blanca según fondo, conforme a las versiones
  corporativas del manual. Se extrae como SVG/PNG de los assets de mobile si
  existen; si no, texto "BAYKA" en Linux Biolinum como fallback provisorio.

## 4. Modelo de datos (migración `024_web_admin.sql`, PROPUESTA)

- **A16 — La migración 024 NO se aplica a producción** en este milestone; queda
  en `supabase/migrations/` para revisión, igual que la 023 (GPS) que sigue
  pendiente de aplicar. La web se desarrolla contra ese esquema objetivo.
- **A17 — `profiles.rol`** extiende su CHECK a `('admin','tecnico','superadmin')`.
  Las políticas RLS que hoy chequean `rol = 'admin'` pasan a `rol IN
  ('admin','superadmin')`. Solo un superadmin puede modificar `profiles.rol`.
- **A18 — Campos nuevos de `plantations`** (todos opcionales, no rompen clientes
  viejos ni `sync_subgroup`):
  - `descripcion text` — notas libres.
  - `fecha_inicio date` — inicio real de la plantación (`periodo` es etiqueta).
  - `superficie_ha numeric` — superficie en hectáreas.
  - `ubicacion_lat` / `ubicacion_lng double precision` — centroide aproximado.
  - `objetivo_arboles integer` — meta de árboles para seguimiento en dashboard.
  - `visible_in_app boolean NOT NULL DEFAULT true` — ver A19.
- **A19 — `visible_in_app`** controla si la plantación aparece en la Bayka App
  para técnicos. Default `true` (las existentes no cambian de comportamiento).
  Los admin en mobile siguen viendo todo, con indicador de "oculta". El filtro es
  solo de listado: los datos pendientes de un técnico sincronizan igual.
- **A20 — Configuración GPS por plantación:** la web edita
  `gps_capture_frequency` (entero ≥ 1, default 10) y `gps_capture_required`
  (boolean, default true), columnas creadas por la migración 023 del milestone
  GPS. La web no introduce parámetros GPS nuevos.

## 5. Funcional

- **A21 — Creación de plantaciones** con paridad mobile: estado inicial
  `activa`, organización tomada del perfil del creador, y parcela default
  `P1 / Parcela 1` (mismo comportamiento que el flag AUTO_PARCELA de mobile).
- **A22 — La web no permite finalizar plantaciones ni generar IDs** en v1: ese
  flujo (gate de finalización + seed de global_id) ya existe en mobile y
  duplicarlo sin los checks locales sería riesgoso. Editar `estado` queda fuera
  del formulario web.
- **A23 — Explorador de datos read-only.** Parcelas/grupos/árboles se visualizan
  (con filtros y paginación) pero no se editan desde la web en v1: el alta y
  corrección de árboles es flujo de campo (mobile, offline-first). La edición
  web podría pisar datos no sincronizados.
- **A24 — Dashboard:** KPIs + torta por especie + barras por parcela + línea de
  registros por mes. Especies con < 3% se agrupan en "Otras"; árboles sin
  especie se muestran como "Sin identificar" (N/N) en amarillo, igual que mobile.
- **A25 — Fotos:** se muestran vía signed URLs del bucket privado `tree-photos`
  (60 min de validez), generadas on-demand al abrir el detalle.

## 6. Proceso

- **A26 — PRs apilados** sobre `feat/gps-101-kml` (rama pedida como base, aún sin
  mergear a main): cada PR usa como base la rama del PR anterior para mantener
  diffs ≤ 400 LOC. Nada se mergea a main en este milestone.
- **A27 — El presupuesto de 400 LOC por PR excluye** `package-lock.json`, assets
  binarios (fuentes, imágenes) y este documento.
- **A28 — Credenciales:** la web usa el mismo proyecto Supabase y la misma anon
  key que mobile (ya versionada en `mobile/eas.json`); van en `web/.env` local
  (gitignoreado) con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **A29 — CI:** workflow mínimo (typecheck + lint + tests de `web/`) en GitHub
  Actions, disparado solo por cambios en `web/**`.
