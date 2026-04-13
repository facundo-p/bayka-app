# Phase 13: Unificar sync bidireccional - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Reemplazar los botones separados de "Descargar datos" y "Subir datos" por un unico boton "Sincronizar" que ejecuta pull+push en una sola operacion. Introducir dirty flag a nivel subgrupo para tracking granular de cambios locales pendientes. Indicador visual (orange dot) centralizado para pendientes de sync. Setting persistente para incluir/excluir fotos.

**Fuera de scope:**
- Sincronizar subgrupos activos o con N/N sin resolver (fase futura)
- Cambios en CatalogScreen (sigue siendo flujo aparte)
- Reapertura de plantaciones finalizadas por admin (quick task aparte)

</domain>

<decisions>
## Implementation Decisions

### Sync unificado
- **D-01:** Boton unico "Sincronizar" reemplaza "Descargar datos" y "Subir datos". Ejecuta pull+push bidireccional en una sola operacion.
- **D-02:** Sync solo sincroniza plantaciones ya descargadas localmente. El CatalogScreen y su flujo de descarga inicial se mantienen completamente separados e independientes.
- **D-03:** Dos puntos de entrada: boton global en header de PlantacionesScreen (sincroniza TODAS las plantaciones locales) + opcion por plantacion individual en el gear/bottom sheet.
- **D-04:** Setting persistente para incluir/excluir fotos en sync. Se configura una vez y aplica siempre (no preguntar cada vez). Debe haber forma de cambiar el setting (toggle en modal de sync o en perfil).

### Dirty flag
- **D-05:** Dirty flag a nivel subgrupo: `subgroups.pendingSync` (boolean). Cualquier mutacion local (crear arbol, editar arbol, crear subgrupo, finalizar, revertir orden, resolver N/N) marca `pendingSync = true`. Sync exitoso lo marca `false`.
- **D-06:** Fotos mantienen su flag independiente `fotoSynced` en la tabla trees. El dirty flag del subgrupo es ortogonal al sync de fotos.
- **D-07:** "Sincronizada" deja de existir como estado de subgrupo. Los estados son: `activa` y `finalizada`. La inmutabilidad se determina por el estado de la plantacion (finalizada), no del subgrupo.

### Indicadores visuales
- **D-08:** Orange dot como indicador de cambios pendientes. Reemplaza el chip "Sincronizado" que existia antes. El color del dot DEBE estar centralizado en `theme.ts` (ej: `colors.syncPending`) — fuente de verdad unica.
- **D-09:** Orange dot aparece en: PlantationCard (si alguno de sus subgrupos tiene pendingSync=true o fotos pendientes), SubGroupCard (si ese subgrupo tiene pendingSync=true), icono de sync global en header de PlantacionesScreen (si hay cualquier cosa pendiente de sync en cualquier plantacion).
- **D-10:** Cuando no hay nada pendiente, no se muestra dot (no hay "dot verde de sincronizado" — la ausencia de dot = todo al dia).

### Modelo de datos
- **D-11:** Requiere migracion Drizzle: agregar columna `pendingSync` (boolean, default true) a tabla `subgroups`.
- **D-12:** Progreso y manejo de errores parciales: a definir durante planning. El researcher debe investigar patrones de progress reporting para sync bidireccional.

### Claude's Discretion
- Flujo exacto del SyncProgressModal para mostrar progreso bidireccional (fases pull/push)
- UX de la configuracion del setting de fotos (toggle en modal, en perfil, o ambos)
- Estrategia de rollback si falla a mitad de sync (continuar con el resto o parar)

### Folded Todos
None.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sync core
- `mobile/src/services/SyncService.ts` — Orquestador principal de sync. Contiene syncPlantation(), pullFromServer(), uploadSubGroup(), uploadPendingPhotos(), downloadPhotosForPlantation(), batchDownload()
- `mobile/src/hooks/useSync.ts` — Hook React que expone startSync() y startPull(). Maneja estados de progreso y resultados.

### UI components
- `mobile/src/components/SyncConfirmModal.tsx` — Modal de confirmacion antes de sync (hoy pregunta si incluir fotos)
- `mobile/src/components/SyncProgressModal.tsx` — Modal de progreso durante sync
- `mobile/src/components/DownloadProgressModal.tsx` — Modal de progreso de batch download
- `mobile/src/components/AdminBottomSheet.tsx` — Bottom sheet con botones Descargar/Subir (a reemplazar por Sincronizar)

### Screens
- `mobile/src/screens/PlantacionesScreen.tsx` — Pantalla principal. Maneja estado de sync, modales, gear icon por plantacion
- `mobile/src/screens/CatalogScreen.tsx` — NO modificar. Se mantiene separado.

### Data layer
- `mobile/src/database/schema.ts` — Schema SQLite. Agregar pendingSync a subgroups.
- `mobile/src/repositories/SubGroupRepository.ts` — getSyncableSubGroups(), markAsSincronizada() (a refactorear)
- `mobile/src/repositories/TreeRepository.ts` — getTreesWithPendingPhotos(), markPhotoSynced()
- `mobile/src/hooks/usePendingSyncCount.ts` — Counts para badges de pendientes

### Theme
- `mobile/src/theme.ts` — Centralizar color del orange dot (syncPending)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncService.syncPlantation()` — Ya hace pull-then-push. Es la base para el sync unificado, pero necesita refactoring para aceptar sync global (multiple plantaciones).
- `SyncProgressModal` — Muestra progreso de sync. Necesita adaptarse para flujo bidireccional.
- `usePendingSyncCount` — Ya cuenta subgrupos pendientes. Necesita extenderse para considerar el nuevo `pendingSync` flag.
- `SyncConfirmModal` — Se simplifica: ya no pregunta incluir fotos (es setting persistente). Podria convertirse en un simple "Sincronizar?" con toggle de fotos.

### Established Patterns
- Atomic sync via RPC `sync_subgroup` — ON CONFLICT DO NOTHING. Se mantiene.
- Pull-before-push para consistencia — Se mantiene.
- `notifyDataChanged()` para refresh de UI post-sync — Se mantiene.
- Drizzle migrations: SQL + journal + migrations.js (MUST update 3 files).

### Integration Points
- PlantacionesScreen header: agregar boton de sync global + orange dot
- AdminBottomSheet: reemplazar dos botones por uno "Sincronizar"
- PlantationCard: agregar orange dot cuando tiene subgrupos con pendingSync=true
- SubGroupCard: agregar orange dot cuando pendingSync=true
- Todas las mutaciones de subgrupo/arbol: marcar pendingSync=true

</code_context>

<specifics>
## Specific Ideas

- Orange dot debe ser pequeno y consistente en todos los lugares donde aparece (PlantationCard, SubGroupCard, sync icon global)
- "La fuente de verdad del color del orange dot este centralizado — si se cambia para uno se cambia para todos" (cita directa del usuario)
- El sync global debe sincronizar TODAS las plantaciones locales en una sola operacion, no pedir seleccionar

</specifics>

<deferred>
## Deferred Ideas

- **Sincronizar subgrupos activos y con N/N:** El usuario menciono "pronto permitire sincronizar todo, incluso subgrupos activos o con N/N". Esto es fase futura — el dirty flag prepara la infraestructura pero el scope actual solo sincroniza finalizados.
- **Reapertura de plantacion finalizada por admin:** Admin podria reabrir una plantacion finalizada (vuelve a estado "activa"). Funcionalidad nueva que podria ser quick task aparte o fase futura.

</deferred>

---

*Phase: 13-unificar-sync-bidireccional*
*Context gathered: 2026-04-13*
