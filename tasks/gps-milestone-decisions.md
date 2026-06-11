# Milestone GPS — decisiones tomadas de forma autónoma

Registro de toda decisión/asunción que tomé sin consultar durante la ejecución
autónoma del milestone (2026-06-10). Las decisiones ya cerradas por vos en los
issues no se repiten acá.

## Bugs de UAT (2026-06-11)

- **#113 (crítico, FIXED en PR #112):** migraciones 0015/0016 se salteaban en
  devices existentes porque su `when` era menor que el de las 0000–0007
  (timestamps 2026). drizzle aplica solo si `when > max(created_at)` del device.
  Fix: `when` de 0015=1774300000000 / 0016=1774400000000 (> máx global). NO se
  tocan 0008–0014 (ya desplegadas; re-dispararían sus ALTER). Tests:
  `journalMonotonic` + `migrationIncremental` (reproduce y bloquea la regresión).
  **Regla nueva: toda migración futura debe tener `when` > el de todas las
  anteriores** (idealmente `Date.now()` real al crearla).
- **#114 (a verificar):** semáforo GPS en "Sin señal". Medido sobre el build con
  #113 roto (diagnóstico confundido). Re-testear sobre build corregido: permiso
  de ubicación, GPS del device encendido, al aire libre. Mitigación: el admin
  puede apagar "Captura GPS obligatoria" por plantación para desbloquear.

## Estrategia general

- **PRs apilados**: cada rama parte de la anterior (`feat/gps-95-infra` ← main,
  `feat/gps-96-schema-sync` ← 95, etc.) y cada PR apunta a la rama anterior.
  Al mergear en orden, GitHub re-apunta los PRs automáticamente. Motivo: los
  issues tienen dependencias duras y no puedo mergear PRs por mi cuenta.

## #95 — Infra (PR #104)

- **Constantes nuevas no pedidas explícitamente**: `GPS_FIX_REQUEST_TIMEOUT_MS = 15 s`
  (timeout del fix pedido al tap, #97) y `GPS_FIX_STALE_MS = 10 s` (edad a partir
  de la cual el semáforo de #98 muestra "sin señal"). Elegí 10 s para el stale:
  con el watcher en máxima frecuencia, no recibir fixes por 10 s indica pérdida
  real de señal.
- **Watcher**: `Accuracy.BestForNavigation`, `timeInterval: 0`, `distanceInterval: 0`
  (máxima frecuencia, como pediste para plantaciones densas).
- **Estados de permiso en español**: `'pendiente' | 'otorgado' | 'denegado'`.
- El permiso en `AndroidManifest.xml` quedó solo local: `mobile/android/` está
  gitignorado. El build local lo usa; un clone fresco lo regenera del plugin.

## #96 — Schema + sync (PR #105)

- **Preservación atómica del punto en el pull**: las 4 columnas GPS se deciden
  juntas mirando `latitude` local (si hay punto local, se conservan las 4; si no,
  se adoptan las 4 del server). Evita mezclar lat de un fix con accuracy de otro.
- **Pull refresca config GPS incluso con `pendingEdit=true`** (como definiste en
  el issue). OJO: cuando #100 haga editable la config offline, ese caso se
  revisita (el refresh podría pisar una edición offline de config GPS entre la
  edición y el push). Lo resuelvo en #100.
- **Migración 023 NO aplicada a Supabase prod aún**: la aplico al final del
  milestone, antes del build, para que el sync funcione en el device (es
  aditiva + hay backup R2 automático). Hasta aplicarla, el pull de metadata
  loguea error y no refresca (guard incluido), el resto de la app funciona.
- `when` del journal 0015: `1749500000000` (sigue la secuencia ficticia
  creciente del repo, no es un timestamp real).

## #97 — Captura al tap (PR #106)

- **Desvío del texto del issue**: `InsertTreeParams` NO ganó campos GPS. La regla
  necesita la posición y la calcula `insertTree` adentro (MAX+1) → el punto va
  siempre por `UPDATE` post-alta (`updateTreeGps`), que además re-marca
  `pendingSync`. Coincide con tu decisión de adjuntar async.
- **N/N también captura**: `registerNN` insertaba por su cuenta; unifiqué ambos
  flujos en `insertTreeWithGps`. En N/N el "momento del tap" es post-foto (el
  técnico sigue junto al árbol; la cámara pudo pausar el watcher).

## #98 — Semáforo (PR #107)

- Tokens `gpsGood/gpsRegular/gpsBad/gpsNone` propios en theme (duplican hex de
  stateActiva/secondaryYellowDark/danger a propósito: cambiar el semáforo no
  debe tocar los chips de estado).
- Tick interno de 1 s (`GPS_SIGNAL_UI_REFRESH_MS`) para degradar a "señal
  perdida" cuando dejan de llegar fixes.
- Ubicación: fila del label de LastThreeTrees (slot `headerAccessory`).
- Refactor 8.1 de paso: LastThreeTrees → .styles.ts.

## #99 — Pin (PR #108)

- **Sin tooltip al tap** (el issue lo dejaba opcional): el repo no usa
  Alert.alert (todo va por ConfirmModal) y no justifica el plumbing. Pin único
  sin distinción de calidad (propuesta del issue aceptada).
- Query de useTrees extraída a `queries/treeQueries.ts` (regla 9; estaba inline
  en el hook). Refactor 8.1 de paso: TreeRowItem → .styles.ts.

## #100 — Config admin (PR #109)

- **Config GPS sin snapshot/discard propio**: `discardPlantationEdit` sigue
  revirtiendo solo lugar/periodo. Como el pull SIEMPRE refresca la config
  (#96), tras un descarte converge sola en el próximo sync. Evita columnas
  `*Server` nuevas (= otra migración). Ventana de inconsistencia mínima:
  `uploadPendingEdits` corre antes del pull en el ciclo de sync.
- `uploadPendingEdits`/`uploadOfflinePlantations` suben las columnas GPS
  siempre (espejo idempotente cuando no se editaron).
- Campos GPS visibles también al CREAR plantación (no solo editar), default
  10/obligatoria-ON.

## #102 — Captura obligatoria (PR #110)

- **Permiso 'pendiente' bloquea** cuando la captura es obligatoria: con permiso
  ya otorgado el request resuelve al instante y el bloqueo no se ve; durante el
  diálogo inicial evita altas sin punto.
- **Re-chequeo en caliente vía AppState**: useGpsWatcher re-arranca al volver
  la app a foreground (cubre "volver de Ajustes" y revocación del permiso con
  la pantalla abierta). useFocusEffect solo no alcanzaba (no refirea al volver
  de otra app).
- `servicesEnabled === null` (aún sin chequear) NO bloquea: solo bloquea el
  `false` confirmado.

## #103 — Re-captura (PR #111)

- **Captura manual a demanda**: si el último árbol quedó sin punto por
  frecuencia, el botón cambia a "Capturar" (propuesta del issue aceptada).
- `attachGpsCapture` ahora devuelve boolean (true = punto escrito) para el
  feedback de la re-captura; el alta lo sigue usando fire-and-forget.
- `getAccuracyLevel` extraído (umbrales en un solo lugar) y `GPS_LEVEL_COLOR`
  compartido entre el semáforo y la fila de re-captura.

## #101 — KML (PR #112)

- Ícono: `placemark_circle.png` de Google Earth tintado vía `<color>` del
  IconStyle (el PNG blanco es tintable). Paleta de 10 colores aabbggrr,
  asignación por hash determinístico del nombre de especie (misma especie →
  mismo color en todo export; puede haber colisión con >10 especies).
- Archivo: `<lugar>_puntos.kml` en Paths.cache (patrón CSV/Excel).
- Plantación sin puntos: throw con mensaje claro → diálogo estándar del flujo
  de export (sin archivo vacío).
- N/N con punto se exporta con etiqueta "N/N" (LEFT JOIN species; el CSV en
  cambio excluye N/N por INNER JOIN — comportamiento preexistente, no lo toqué).

## Code review (post-implementación) — fixes aplicados sobre la rama tip

Se corrió `/code-review` sobre los 9 PRs. Se aplicaron 3 hallazgos (en
`feat/gps-101-kml`, la punta del stack; al mergear en orden el estado final de
main queda correcto):

- **#1 (discard no revertía la config GPS) — fix profundo elegido por el usuario.**
  SUPERSEDE la decisión previa de "config GPS sin snapshot, converge por pull".
  Ahora la config GPS tiene snapshot local `gpsCaptureFrequencyServer`/
  `gpsCaptureRequiredServer` (migración local **0016**, solo-cliente, no toca
  Supabase), espejando `lugarServer`/`periodoServer`. `updatePlantation`
  snapshotea, `discardPlantationEdit` revierte, y `pullPlantationMetadata` ahora
  respeta `pendingEdit` también para las columnas vivas de GPS (antes las pisaba
  siempre) y refresca el snapshot. Comportamiento idéntico a lugar/periodo.
- **#2 (colisión de styleId en KML).** El color del placemark ahora se deriva
  del slug (no del nombre crudo) y `buildSpeciesStyles` deduplica por styleId →
  nunca quedan dos `<Style>` con el mismo id y distinto color. Slug vacío →
  `especie-sin-nombre`.
- **#4 (magic constant).** Nueva `GPS_CAPTURE_REQUIRED_DEFAULT` en
  `constants/gpsCapture.ts`, usada en schema/form/hook; las migraciones SQL
  mantienen el literal con comentario que referencia la constante (igual que la
  frecuencia).

No aplicados (quedan como nota): #3 (capturas GPS concurrentes sin coalescing,
edge case con watcher caído), #5 (invariante cross-columna del pull, ok porque
updateTreeGps es el único writer), #6 (flicker del banner tras destrabar),
#7/#8 (cobertura de tests).

⚠️ La migración **0016** es nueva: el APK ya buildeado NO la tiene. Rebuild
necesario para probar el discard de config GPS en device.

## Cierre del milestone

- **Stack de PRs (mergear en este orden)**: #104 → #105 → #106 → #107 → #108
  → #109 → #110 → #111 → #112. Cada uno apunta al anterior; al mergear en
  orden GitHub re-apunta solo.
- **⚠️ Migración Supabase 023 NO aplicada a prod**: no hay DATABASE_URL local
  (vive en los secrets de GitHub Actions). Antes de probar sync en el device,
  pegar `supabase/migrations/023_gps_capture.sql` en el SQL Editor del
  dashboard. Hasta entonces: la captura local funciona entera, pero el push de
  ediciones/creaciones de plantación y el pull de metadata fallan contra las
  columnas nuevas (logueado, no rompe la app).
- **UAT sugerido en device**: 1) registrar árboles con N=10 → pin en posición
  1 y 11; 2) semáforo cambia con la señal; 3) re-captura del último árbol;
  4) plantación con captura obligatoria + GPS apagado → botonera bloqueada +
  diálogo del SO; 5) export KML → abrir en Google Earth; 6) config admin de
  frecuencia/obligatoriedad llega al técnico tras sync (requiere migración 023).
