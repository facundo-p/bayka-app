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

## Trazabilidad: todo PR con Issue y visible en el board (OBLIGATORIO — vigente desde 2026-08-19)

El Project **Bayka** (GitHub Project #1 de `facundo-p`) es la vista de gestión
del proyecto. Un PR que no aparece ahí es trabajo invisible.

- **Todo PR arranca de un Issue.** Si no existe, crearlo *antes* de abrir el PR
  — también para un chore de una línea: título y dos renglones alcanzan.
- **El PR linkea el Issue con `Closes #N` en el body**, no con una mención
  suelta. `Closes` crea el link real (mueve la tarjeta del Issue y lo cierra al
  mergear); un `#N` a secas no linkea nada.
- **El PR además se agrega al board como item propio.** El link al Issue NO
  alcanza: linkear mueve la tarjeta del *Issue*, nunca crea la del *PR*. De eso
  se encarga el workflow "Auto-add to project", prendido con filtro
  `is:issue,pr is:open` — o sea que cubre Issues **y** PRs. No hace backfill de
  lo que ya existía: un item abierto de antes hay que agregarlo a mano, igual
  que si el auto-add fallara:

  ```sh
  gh project item-add 1 --owner facundo-p --url <url-del-PR>
  ```

- **Chequeo de cierre:** antes de dar un PR por entregado, confirmar que se ve
  en el board. Para listar items y su tipo:

  ```sh
  gh project item-list 1 --owner facundo-p --format json
  ```

### Views del board: Issues y PRs separados

El Project tiene tres views. Mezclarlos en una sola confunde: un Issue y el PR
que lo resuelve son la misma unidad de trabajo en dos momentos distintos.

| View | Filtro | Para qué |
| --- | --- | --- |
| `Issues` (board) | `is:issue` | En qué anda cada unidad de trabajo |
| `PRs` (board) | `is:pr` | Qué código está esperando review / ya en staging |
| `View 1` (tabla) | — | Vista cruda de todo, para buscar |

### Estados: el Issue y su PR se mueven juntos

Los dos usan el mismo campo `Status`, cada uno en su view:

| Momento | Status del **PR** | Status del **Issue** |
| --- | --- | --- |
| Issue creado | — | `Backlog` |
| Trabajando | — | `En progreso` |
| PR abierto contra `staging` | `PR en review` | `En progreso` |
| PR mergeado a `staging` | `En staging` | `En staging` (y el Issue se cierra) |
| Validado en staging | — | `Esperando OK` |
| Mergeado a `main` y desplegado | `En prod` | `En prod` |

`Bloqueado` es transversal: frenado por algo externo o por una decisión pendiente.

**Cómo se mantiene solo el vínculo Issue ↔ PR.** El branch default del repo es
`staging`, así que al mergear un PR con `Closes #N` **GitHub cierra el Issue
nativamente**. De ahí se encadenan tres workflows del Project (Project → ⋯ →
Workflows; se prenden por UI, no hay API pública):

- **`Item closed` → `En staging`**: el Issue que se cierra por el merge cae solo
  en `En staging`. Este es el que hace que "mergeo un PR a staging y su Issue
  pasa a En staging".
- **`Pull request merged` → `En staging`**: mueve la tarjeta del *PR*, que si no
  se queda clavada en `PR en review`.
- **`Auto-close issue`**: cinturón y tiradores para los Issues linkeados desde el
  panel Development en vez de con `Closes`.

**Dos límites que hay que bancarse a mano** (ningún workflow los distingue):

1. El Issue **se cierra al llegar a staging, no a prod** — es comportamiento
   nativo de GitHub porque el branch default es `staging`. El pase a `En prod`
   se hace a mano en el pase `staging → main`.
2. El PR de release `staging → main` también dispara `Pull request merged` y
   queda en `En staging`; hay que moverlo a `En prod`.

**Al abrir un PR hay que moverlo a `PR en review`.** El workflow
`Item added to project` está prendido con default `Backlog`, que es lo correcto
para un Issue nuevo pero no para un PR:

```sh
gh project item-edit --id <item-id> --project-id PVT_kwHOAlH2RM4BPDWt \
  --field-id PVTSSF_lAHOAlH2RM4BPDWtzg9kyak --single-select-option-id 82eeff6d
```

Ids de las opciones de `Status`: `Backlog` `fd84d80b` · `En progreso` `c7b95fec`
· `PR en review` `82eeff6d` · `En staging` `c92c5785` · `Esperando OK` `fe66a85a`
· `En prod` `033672b0` · `Bloqueado` `7c1c8ba6`.


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