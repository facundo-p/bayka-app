# Proyecto: Bayka App

## Flujo de branches y deploy (OBLIGATORIO — vigente desde 2026-08-14)

- **`main` = PRODUCCIÓN. `staging` = integración y testing** (branch default de GitHub).
- **TODO código nuevo sale de `staging` y su PR apunta a `staging`.** Nunca abrir
  PRs contra `main`.
- **NADA pasa de `staging` a `main` sin confirmación explícita de Facu.** El pase
  a producción es un PR `staging → main` que solo él aprueba y mergea. `main`
  tiene branch protection (sin push directo).
- Entornos por branch:
  - `staging` → Supabase **Plantaciones Staging** (`uchejlyyabtrjoxyydmb`, cuenta
    del cliente) + web staging en Cloudflare Pages + APK variante TEST.
  - `main` → Supabase prod (proyecto pendiente de creación, #245) + web prod +
    APK de producción. Hasta el cutover (#254), el prod "viejo" es
    `apktttwrmhamfudjeklu`.
- Migraciones de DB: se aplican primero a staging; a prod recién con el pase a
  `main` correspondiente y confirmación dedicada.

## Releases y versionado (OBLIGATORIO — vigente desde 2026-08-20)

- **Versiones separadas por app**: web en `web/package.json`, mobile en
  `mobile/app.json` (`expo.version` + `expo.android.versionCode`;
  `mobile/package.json` es espejo). El `package.json` de la raíz está congelado
  en 1.0.0 y no significa nada — no bumpearlo nunca.
- **El pase a prod se arma SOLO con el skill `/deploy`** (#273): calcula bumps
  semver por conventional commits clasificados por paths, propone changelog, y
  con OK de Facu commitea el release en staging y abre el PR staging→main.
  Detalle en `.claude/skills/deploy/SKILL.md`.
- **Tags `web-vX.Y.Z` / `mobile-vX.Y.Z` + GitHub Releases**: los crea
  `.github/workflows/release-tags.yml` al mergear a main, con notas extraídas
  de `CHANGELOG.md` (los headers `## `/`### ` del changelog son anclas de ese
  workflow — no cambiarles el formato).
- **Changelog doble** (#279): `CHANGELOG.md` es el técnico/interno (con `#N`
  linkeables); `NOVEDADES.md` es el público para usuarios/clientes — redacción
  de release notes comerciales, solo cambios visibles al usuario, sin
  issues/PRs ni jerga interna. `/deploy` propone y commitea las dos entradas
  juntas en cada release.
- **Única excepción de push directo a staging**: el commit `chore(release): …`
  que genera `/deploy` (mecánico, con OK previo, revisado dentro del diff del
  PR de release). Todo lo demás sigue entrando por PR a staging.
- **Con un PR de release abierto NO se mergea nada a staging** (si pasa,
  `/deploy` tiene modo "refrescar").
- **Hotfix directo a main** (excepcional): su PR lleva bump patch + entrada de
  changelog propios; back-merge main→staging inmediato después del merge.
- Release con cambios mobile ⇒ **APK nuevo** (versionCode +1); OTA
  (`push-update-apk`) solo para hotfixes dentro de una misma versión. La web se
  deploya en CADA merge a main aunque no haya bump — el número de versión no es
  "hash de lo deployado".

## Trazabilidad: todo PR con Issue y visible en el board (OBLIGATORIO — vigente desde 2026-08-19)

Project **Bayka** = GitHub Project #1 de `facundo-p`, con views separadas
`Issues` (`is:issue`) y `PRs` (`is:pr`). Un PR que no aparece ahí es trabajo
invisible.

- **Todo PR arranca de un Issue**, aunque sea un chore de una línea.
- **`Closes #N` en el body del PR.** Una mención `#N` suelta no linkea nada.
- **El PR se agrega al board como item propio**; linkear el Issue no lo crea. Lo
  hace el workflow "Auto-add to project", que no hace backfill ni es infalible:

  ```sh
  gh project item-add 1 --owner facundo-p --url <url-del-PR>
  ```

- **Al abrir el PR, moverlo a `PR en review`** (el auto-add lo deja en `Backlog`):

  ```sh
  gh project item-edit --id <item-id> --project-id PVT_kwHOAlH2RM4BPDWt \
    --field-id PVTSSF_lAHOAlH2RM4BPDWtzg9kyak --single-select-option-id 82eeff6d
  ```

- **Mergear a `staging` cierra el Issue y mueve ambas tarjetas a `En staging`.**
  Automático, vía los workflows del Project.
- **`En prod` es manual**, para el Issue y para el PR de release: ningún workflow
  distingue el base branch. Option id `033672b0`.
- `Esperando OK` = validado en staging, a la espera del visto bueno para `main`.
- Antes de dar un PR por entregado, confirmar que se ve en el board:
  `gh project item-list 1 --owner facundo-p --format json`

Resto de option ids: `gh project field-list 1 --owner facundo-p`. Diseño del
board, tabla de estados y límites conocidos: #269.

## Reglas de trabajo

1. Planning obligatorio antes de código.
   - Dividir en tareas pequeñas.
   - Consultar decisiones importantes.
   - Detectar ambigüedades.
   - No implementar sin aprobación explícita.

2. Cada funcionalidad debe definir:
   - Comportamiento esperado
   - Criterios de verificación
   - Casos borde
   - Implementar y validar tests

3. Calidad de código
   - No duplicar código.
   - Refactor si función >20 líneas.
   - Separar lógica y presentación.
   - Actualizar archivos de documentación .md que hayan quedado desactualizados
   - **Sin "magic constants".** Códigos de error / valores externos (p.ej. SQLSTATE
     de Postgres `'23505'`/`'42501'`) van en un módulo de constantes nombradas y
     documentadas (ver `mobile/src/supabase/postgresErrorCodes.ts`), NUNCA como
     literal suelto comparado contra `error.code`. Un literal opaco no se
     autodocumenta, no se grepea y nadie nota si cambia el contrato.
     **Enforzado por eslint** (`no-restricted-syntax` en `mobile/eslint.config.js`:
     falla ante un SQLSTATE literal en una comparación de igualdad).
   - **En cada code-review** (skill `/code-review`): incluir explícitamente la
     búsqueda de *magic constants / códigos de error hardcodeados* como dimensión
     a chequear, además de bugs/reuse/simplificación.
   - **Comentarios concisos (OBLIGATORIO, vigente desde 2026-09-03, #293).**
     Un comentario dice lo necesario con la menor cantidad de palabras, sin ser
     críptico. Prohibido: claves internas de planificación (`D-16-13`,
     `PLAN-01`, `OFPL-04`, `Phase 15`, `T02`, `CR1.2`), referencias a secciones
     de `CLAUDE.md`, a `docs/*.md`, a memorias o a planes. Solo `#N` de
     Issues/PRs cuando el contexto lo necesite. Si el comentario repite lo que
     el código ya dice, o contradice al código, se borra o se corrige. Un
     comentario que explica *por qué* (decisión, contrato externo, edge case)
     vale; uno que narra *qué* hace la línea siguiente, no.

4. Eficiencia
   - Preguntar si algo es ambiguo.
   - Minimizar consumo de contexto.
---

### 5. Estrategia de Subagentes
- Use subagents liberally to keep main context windows clean
- For complex problems, throw more compute at it via subagents

---

### 6. Self.Improvement Loop

- After ANY correction from the user: update 'tasks/lessons.md' with the pattern 
- Write rules for yourself that prevent the same mistake
 - Ruthlessly iterate on these lessons until mistake rate drops 
 - Review lessons at session start for relevant project 

--- 

### 7. GitHub Issues

- Don't assume. Ask questions if needed.
- When addressing an issue, update it with the plan(s) approved by user.
- When fishing an Issue, update it with the results and relevant considerations.
- When asking questions to the user, add the replies to issue description.
- For complex problems, create sub-issues and follow this same rules on them.
- Todo Issue termina en un PR que lo cierra con `Closes #N` y que se ve en el
  board: ver "Trazabilidad" arriba.

--- 

## Task Management 
1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items 
2. **Verify Plan**: Check in before starting implementation 
3. **Track Progress**: Mark items complete as you go 
4. **Explain Changes**: High-level summary at each step 
5. **Document Results**: Add review section to 'tasks/todo.md' 
6. **Capture Lessons**: Update 'tasks/lessons.md' after corrections

## Frontend Rules

- React funcional con hooks.
- Componentes pequeños y reutilizables.
- Sin inline styling.
- CSS separado y reutilizable.
- Parametrizar colores y variables comunes.

### 8.1 Styles en archivo .styles.ts dedicado (OBLIGATORIO)

Todo componente o pantalla con estilos DEBE tener un archivo sibling
`<Name>.styles.ts` exportando `<camelCaseName>Styles`. **Prohibido** dejar
`StyleSheet.create(...)` dentro del `.tsx`. Los tokens (`colors`, `fontSize`,
`spacing`, `borderRadius`, `fonts`) siempre se importan desde `src/theme.ts`
— nunca hex/px/strings hardcoded.

Patrón canónico (ver `ParcelaRow.styles.ts`, `PlantationCard.styles.ts`,
`CatalogScreen.styles.ts`):

```ts
// Foo.styles.ts
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const fooStyles = StyleSheet.create({ /* ... */ });
```

```tsx
// Foo.tsx
import { fooStyles as styles } from './Foo.styles';
```

Regla práctica: si encontrás `StyleSheet.create` en un `.tsx`, refactorizalo
al `.styles.ts` en el mismo PR.

### 8. Diseño centralizado y código compartido (OBLIGATORIO)

**Colores, espaciado, tipografía y estilos comunes** DEBEN definirse en un único archivo de tema (`src/theme.ts`). Nunca hardcodear valores de color o tamaño directamente en los archivos de pantalla o componente. Si necesitás un color, importalo del tema.

**Cero código duplicado entre roles (admin/tecnico).** Las pantallas que comparten funcionalidad (plantaciones, subgrupos, perfil, etc.) DEBEN ser componentes compartidos en `src/components/` o `src/screens/`, parametrizados por rol si es necesario. Las carpetas `(admin)` y `(tecnico)` solo deben contener archivos de layout de navegación y wrappers mínimos que importen los componentes compartidos.

**Regla de un solo lugar:** Para cambiar un color, un estilo común, o un comportamiento compartido, debe ser necesario editar UN SOLO archivo. Si hay que tocar más de un archivo para un cambio de estilo, es un bug de arquitectura.

### 9. Separación lógica de datos y presentación (OBLIGATORIO)

**Cero queries en pantallas o componentes.** Las pantallas (`src/screens/`) y componentes (`src/components/`) NUNCA deben contener llamadas directas a `db.select()`, `db.insert()`, `db.update()`, `db.delete()` ni SQL inline. Toda lógica de acceso a datos debe estar en:
- `src/repositories/` — mutaciones (insert, update, delete) y queries de entidad
- `src/queries/` — queries de lectura complejas, estadísticas, agregaciones
- `src/services/` — lógica de negocio que coordina múltiples repositorios/queries

**Hooks como puente, no como lógica.** Los hooks (`src/hooks/`) pueden llamar a funciones de repositories/queries y gestionar estado reactivo (useLiveData), pero NO deben contener queries SQL raw. Si un hook necesita una query, esa query se define en `queries/` o `repositories/` y el hook la invoca.

**Queries reutilizables y testeables.** Si una query se usa en más de un lugar, DEBE estar en un archivo de queries. Si una query tiene lógica de negocio (filtros por rol, cálculos de fecha, estado), DEBE poder testearse unitariamente sin renderizar un componente.

**Regla práctica:** Si necesitás importar `db` o tablas del schema en un archivo de `screens/` o `components/`, es un code smell. Extraé la query a `queries/` o `repositories/`.

### 10. Revisión de flujos UX contra la guía (OBLIGATORIO)

Antes de implementar o modificar **cualquier flujo de usuario** (no solo estilos),
revisar el flujo contra `docs/ui-ux-guidelines.md` y levantar la mano si lo viola.

Chequeo mínimo en cada feature/PR que toque un flujo:
- **Tareas atómicas (§19):** ¿estoy pidiendo en N pasos manuales algo que es una
  sola tarea? Si la separación no aporta una decisión/control de negocio real
  (como la sincronización manual de §12), unificar en un solo paso o señalarlo.
- **Mínimas interacciones (§1):** acciones principales en uno o dos toques.
- **Acciones irreversibles (§15):** avisar qué se pierde y qué las dispara.
- **Creación de entidades coherente (§20):** toda pantalla de creación/edición
  (Plantación/Parcela/Grupo/…) usa los componentes compartidos
  (`EntityFormModal` / `KeyboardAwareFormBody` / `FormActions`). El botón de
  acción NUNCA queda tapado por el teclado. Si un formulario nuevo no calza en
  el patrón o reimplementa el layout a mano, es un bug de arquitectura.

Los problemas de UX conceptual no tienen test que los dispare: este chequeo
manual contra la guía es la red de seguridad. Si detectás un olor de diseño,
reportalo aunque no sea parte de la tarea pedida.