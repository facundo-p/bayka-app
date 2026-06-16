# Lessons

## Navegacion post-creacion de entidades
Despues de crear cualquier entidad (plantacion, subgrupo, etc), la app debe navegar automaticamente a la pantalla de detalle/trabajo de esa entidad. No quedarse en la lista ni volver atras. Usar `router.push` para plantaciones (mantiene back stack) y `router.replace` para subgrupos (evita volver al form vacio).

## Fonts: usar siempre el heading font de Bayka para titulos
Todos los titulos (headers, cards, etc) deben usar `fonts.heading` (LinBiolinum_RB), no `fonts.bold` (Poppins). Poppins es para body text, labels, stats y texto secundario. LinBiolinum es la fuente de marca de Bayka y debe usarse consistentemente en todo titulo visible.

## Refactoring: funciones atomicas y zero duplicacion

### Reglas derivadas del refactor de SyncService.ts (909 lineas -> 8 archivos)

1. **Funcion > 20 lineas = code smell.** Extraer inmediatamente en sub-funciones con nombre descriptivo. La funcion orquestadora debe leer como un indice de pasos.

2. **Duplicacion entre orchestrators = extraer funcion compartida.** Si dos funciones de alto nivel comparten un loop o secuencia de pasos, crear una funcion que ambas llamen. Ejemplo: `runGlobalPreSteps()` y `uploadSyncableSubGroups()` eliminaron duplicacion entre `syncPlantation` y `syncAllPlantations`.

3. **Hardcodear strings magicos en multiples lugares = centralizar en utilidad.** El check `startsWith('file://')` estaba en 9 lugares. Centralizar en `isLocalUri()` con soporte para futuros schemes (`content://`).

4. **Logger con tag prefix > console.log directo.** Usar `syncLog.info`/`syncLog.error` en vez de `console.log('[Sync]')`. Facilita mock en tests, grep, y futuro logging estructurado.

5. **Decomposicion pull-then-push:** El patron pull necesita tests de preservacion de estado local (pendingSync, pendingEdit, fotoUrl local). Siempre testear que el pull NO pisa datos locales sucios.

6. **Barrel re-export para refactors seguros.** Mantener el archivo original como `export * from './modulo'` permite refactorizar sin tocar ningun consumidor. Zero import changes en 12 archivos.

7. **Tests ANTES de refactorizar.** Escribir tests de caracterizacion que locken el comportamiento actual antes de mover codigo. Si no hay test para una rama de logica, agregarla primero.

8. **Clasificacion de errores en una sola funcion.** Si el mismo patron if/else-if/else clasifica resultados en multiples lugares, extraer `classifyResult()`. Evita divergencia de logica entre orchestrators.

9. **Un archivo = un dominio.** Separar por responsabilidad: types, pull, push, photos, orchestrators, download. Cada archivo importa solo lo que necesita.

## SQL: verificar la última redefinición antes de un CREATE OR REPLACE

Una función Postgres puede haberse redefinido en varias migraciones. Antes de escribir
una nueva versión (`CREATE OR REPLACE FUNCTION`), buscar TODAS las migraciones que la
(re)definen y basarse en la **más reciente**, no en la primera que aparece en el grep.

Caso real (Issue #55): `sync_subgroup` se redefinió en 002 → 009 → 012 → 012b → 014.
El grep inicial llevó a 009 (`subgroups`/`subgroup_id`), pero la versión vigente era
014 (`groups`/`group_id` tras el rename de 012). Escribir sobre 009 habría roto el RPC
(la columna `subgroup_id` ya es GENERATED, no insertable).

Regla: `grep -rln "FUNCTION <nombre>" supabase/migrations/ | sort` y leer la última.

## Persistencia offline-first: 3 capas + gatillo, no 1

Cuando un dato "se genera local pero no llega al server", revisar:
1. **Payload de push** lo incluye?
2. **RPC/endpoint server** procesa esa columna (INSERT *y* ON CONFLICT)?
3. **Gatillo de re-sync**: algo marca el registro dirty (`pendingSync=true`) DESPUÉS de
   generarlo? Si la generación corre post-sync (todo limpio), nada lo re-sube. ← suele
   ser el bug más sutil.
4. **Pull** no debe pisar el valor local con NULL (preservar/adoptar con COALESCE/CASE WHEN).

## Auditoría de safe-area / teclado: clasificar por CONTEXTO DE PRESENTACIÓN, no por el archivo de la pantalla

Una pantalla NO es "OK" o "AT RISK" en abstracto: depende de **dónde se renderiza**.
El mismo componente puede estar bien dentro del Tabs navigator y mal dentro de un
`Modal` full-screen. El error de la auditoría inicial (issue #73) fue mirar cada
`screen` aislada y asumir que la tab bar siempre reserva el inset inferior.

**Antes de dar un veredicto, trazar el árbol de navegación y responder:**

1. **¿Hay tab bar visible en esta pantalla?**
   - Pantalla de tab (`(tecnico)/(admin)` Tabs) → la tab bar reserva el inset inferior. OK.
   - Stack anidado en Tabs aunque sea `href: null` (ej. `plantation/`) → el espacio
     de la tab bar sigue reservado → un footer `bottom:0` NO se solapa. (Por eso
     CatalogScreen estaba bien y la auditoría se equivocó al marcarlo AT RISK.)
   - **`Modal` full-screen** (`<Modal animationType="slide">`, `presentationStyle="fullScreen"`)
     → **TAPA la tab bar** → NO hay inset inferior → cualquier footer/"Guardar" sin
     `insets.bottom` SE SOLAPA con la barra del SO. ← clase de bug real.

2. **Seguir el componente hasta su call site real.** `ConfigureSpeciesScreen` /
   `AssignTechniciansScreen` viven en `src/screens/` pero se montan dentro de un
   `<Modal>` vía `AdminPlantationModals.tsx` + `AdminModalWrapper`. Auditar el archivo
   suelto miente; hay que grep del componente para ver en qué wrapper se renderiza.

3. **Revisar los wrappers compartidos primero.** Si un wrapper común
   (`AdminModalWrapper`) aplica `insets.top` pero NO `insets.bottom`, TODAS las
   pantallas que lo usan heredan el bug. Un fix de un solo lugar arregla la clase entera.

**Checklist de la auditoría de safe-area, corregido:**
- [ ] Mapear `app/` (expo-router): qué es Tab, qué es Stack anidado, qué es Modal.
- [ ] Para cada footer/botón fijo: ¿su pantalla se presenta en un Modal full-screen? → AT RISK si no tiene `insets.bottom`.
- [ ] Grep de cada componente `screens/*` para encontrar si algún `<Modal>` lo monta.
- [ ] Revisar wrappers compartidos (`*ModalWrapper`, `BaseModal`) por insets faltantes.
- [ ] No confiar en "tiene `paddingBottom`": un padding fijo ≠ `insets.bottom` (varía gesture-nav vs 3-botones).

## Magic constants: códigos de error externos centralizados (corrección PR #68)

**Corrección del usuario:** encontró códigos SQLSTATE de Postgres hardcodeados
como literales sueltos (`error.code === '23505'`, `'42501'`, etc.) en varias
partes de la capa de sync. Es un code smell: el literal no se autodocumenta, es
difícil de grepear, y nadie nota si el contrato cambia o si otro backend emite
otro código.

**Regla para mí:**
1. **Nunca comparar `error.code` contra un literal.** Todo código de error / valor
   externo va en un módulo de constantes nombradas y documentadas. En este repo:
   `mobile/src/supabase/postgresErrorCodes.ts` → `PG_ERROR.UNIQUE_VIOLATION`, etc.
2. **Antes de escribir una comparación contra un código externo**, buscar si ya
   existe la constante; si no, agregarla al módulo con nombre + descripción + ref.
3. **Tests:** las factories de `jest.mock` no pueden referenciar imports (hoisting),
   ahí el literal crudo es aceptable (simula el contrato externo). En los cuerpos
   de test usar la constante.
4. **En cada `/code-review`:** sumar "magic constants / códigos de error
   hardcodeados" como dimensión explícita a buscar (los finder agents no la
   detectan solos; hay que pedirlo en el prompt). Patrón a grepear:
   `\.code === '[0-9A-Z]{5}'` y literales de 5 chars comparados contra `.code`.

## Comentarios: concisos y en un solo idioma

El dueño marcó que hay comentarios **demasiado largos** y que **mezclan inglés y
castellano** en el mismo bloque (p.ej. docblocks que arrancan "Returns the parcela
codigo..." y siguen en español). Reglas:

1. **Un solo idioma: español** (el del codebase y el equipo). No mezclar inglés y
   castellano dentro de un comentario ni de un archivo.
2. **Concisos: explicar el *por qué*, no narrar el código.** Nada de párrafos largos.
3. Si reescribo código con comentarios viejos bilingües/largos, unificarlos en el
   mismo cambio.

## No contemplar casos que el negocio declaró imposibles

El dueño prefiere **afirmar invariantes** (fallar fuerte y visible) antes que
mantener código defensivo que **contempla** un caso que el negocio ya no admite.
Ej.: `getGroupParcelaCodigo` degradaba a `''` para grupos sin parcela; como ya no
existen datos así (migrados), eso es código obsoleto → debe lanzar error, no degradar.
Antes de agregar un fallback/degradación, preguntar si el caso es realmente posible
en el negocio; si no, es un dato inválido a notificar. Evitar, eso sí, fallos
silenciosos (un throw fire-and-forget sin surface es tan malo como degradar).

## Keyword de cierre de issues en PR: SOLO inglés

GitHub auto-cierra un issue al mergear a la rama default solo si el cuerpo/título
del PR usa una **keyword en inglés**: `Closes #N` / `Fixes #N` / `Resolves #N`
(y variantes close/closed, fix/fixed, resolve/resolved). **"Cierra #N" en español
NO la reconoce** — el issue queda abierto aunque el PR se mergee.

Síntoma real (batch 58-75): 10 PR mergeados a `main` con "Cierra #N" → ningún
issue se cerró. Editar el cuerpo después del merge tampoco sirve: el auto-cierre
solo se evalúa al mergear. Hubo que cerrarlos a mano.

Regla: en todo cuerpo de PR usar `Closes #N` (inglés). El resto de la descripción
puede ir en español; solo la línea de keyword debe estar en inglés.

## Migración drizzle-expo: el `when` del journal DEBE ser mayor que TODOS los anteriores

drizzle-orm/expo-sqlite (`sqlite-core/dialect`) aplica una migración solo si su
`when` (folderMillis del journal) es **mayor** que el `max(created_at)` ya
registrado en el device: `if (!last || Number(last.created_at) < migration.folderMillis)`.
Lee `lastDbMigration` UNA vez (ORDER BY created_at DESC LIMIT 1) y compara TODAS
las migraciones contra ese máximo. Si una migración nueva tiene `when` menor que
ese máximo, **se saltea en silencio y `useMigrations` igual reporta `success`**
(la app levanta; las columnas faltan en runtime → "no such column: trees.X").

Caso real (milestone GPS, bug #113): las migraciones 0000–0007 tenían timestamps
de 2026 (~1.7742e12) y las nuevas 0015/0016 quedaron en números redondos
menores (~1.7495e12). En devices que ya habían registrado las 0000–0007 (máx
created_at = 1774200000000), las 0015/0016 nunca corrieron. Síntoma engañoso: el
**conteo** de árboles funcionaba (no toca columnas GPS) pero la **lista** no
(`getTreesForGroup` selecciona latitude/longitude → throw, `useLiveData` lo
traga con `.catch` → lista vacía).

Reglas:
1. **Toda migración nueva DEBE tener `when` estrictamente mayor que el de todas
   las anteriores.** Idealmente `Date.now()` real al generarla; nunca números
   redondos a ojo menores que entries previas.
2. **NO retocar el `when` de migraciones ya desplegadas** para "ordenarlas":
   subirlo por encima del máx del device las RE-dispara (sus ALTER fallan →
   migración en error → app trabada). Solo se corrige hacia adelante.
3. Red de seguridad agregada: `tests/database/journalMonotonic.test.ts`
   (idx≥15 debe superar el máx anterior) y `tests/integration/migrationIncremental.test.ts`
   (siembra `__drizzle_migrations` con max=1774200000000 + SQLite real y verifica
   que la migración nueva se aplica; falla con el `when` viejo).

## Watcher de ubicación: pedir permiso UNA vez y no reiniciarlo en cada AppState 'active'

Caso real (bug #115): `useGpsWatcher` re-pedía `requestForegroundPermissionsAsync`
y reiniciaba el watcher nativo en cada transición a `AppState 'active'`. Pero el
**propio diálogo de permiso manda la app a background y la devuelve a 'active'**
→ dispara el handler de nuevo → re-prompt + reinicio → loop en ráfaga. Síntoma:
**la barra de estado del SO titila** (el ícono de ubicación prende/apaga) y la
app **crashea al inicio** a los pocos segundos. Agravado por `timeInterval: 0`
(inunda el bridge de fixes).

Reglas para hooks de geolocalización con AppState:
1. **Pedir el permiso con diálogo UNA sola vez** (flag tipo `promptedRef`). En
   resume re-chequear con `getForegroundPermissionsAsync` (NO abre diálogo).
2. **No reiniciar un watcher que ya está corriendo** (chequear `subscriptionRef`
   antes de crear otro) — el churn start/stop es lo que hace titilar la barra.
3. **Guard de concurrencia** (`startingRef`) porque AppState + refresh manual
   pueden solaparse.
4. `timeInterval` del watcher en un valor sano (p.ej. 1 s), no 0; la precisión
   al instante se resuelve con `getCurrentPositionAsync` puntual.
