# Phase 14: Sincronizar subgrupos finalizados con N/Ns, resolver N/Ns, bloquear finalización sin N/Ns resueltos - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Permitir que subgrupos finalizados con arboles N/N sin resolver se sincronicen al servidor (arboles suben con especieId=null). Habilitar la resolucion remota de N/N (admin resuelve cualquier N/N, tecnico solo los de sus subgrupos). Detectar conflictos cuando un N/N fue resuelto por dos usuarios distintos. Bloquear la finalizacion de la plantacion (no del subgrupo) si hay N/N sin resolver. Agregar indicadores visuales de N/N en cards.

**Fuera de scope:**
- Sincronizar subgrupos activos (solo finalizados)
- Cambios en el flujo de registro de N/N (sigue igual: foto obligatoria)
- Reapertura de plantaciones finalizadas
- Cambios en CatalogScreen

</domain>

<decisions>
## Implementation Decisions

### Sync de N/N al servidor
- **D-01:** Subgrupos finalizados con arboles N/N sin resolver SE sincronizan normalmente. Eliminar el filtro de `getSyncableSubGroups()` que excluye subgrupos con N/N. Los arboles suben con `especieId=null` y `especieCodigo='NN'`.
- **D-02:** Sin warning previo al sincronizar — los N/N se suben silenciosamente como parte del sync normal.
- **D-03:** La funcion RPC `sync_subgroup` en Supabase debe revisarse y ajustarse si rechaza arboles con `especieId=null`. El arbol debe llegar al servidor con especie null.

### Gate de finalizacion
- **D-04:** La finalizacion de PLANTACION (por admin) se bloquea si hay arboles N/N sin resolver en cualquier subgrupo de la plantacion. Los subgrupos individuales SI se pueden finalizar con N/N.
- **D-05:** El boton "Finalizar plantacion" aparece deshabilitado con texto explicativo: "X arboles N/N sin resolver en Y subgrupos". No se puede tocar.
- **D-06:** El gate actual de finalizacion (todos subgrupos finalizada + pendingSync=false) se extiende con: + no N/N sin resolver en toda la plantacion.

### Resolucion remota de N/N
- **D-07:** El admin puede resolver N/N de cualquier subgrupo de la plantacion (no solo los propios). Cada tecnico solo puede resolver los N/N de sus propios subgrupos (mismo comportamiento que hoy, pero ahora tambien post-sync).
- **D-08:** El acceso a la resolucion de N/N se mantiene como hoy: desde dentro del subgrupo o modo plantacion-wide en NNResolutionScreen. No se agrega acceso nuevo desde el gear menu.
- **D-09:** La resolucion de N/N marca `pendingSync=true` en el subgrupo. Al hacer sync, el subgrupo completo se re-sube con el arbol ya resuelto (mismo RPC sync_subgroup, ON CONFLICT DO UPDATE en arboles).
- **D-10:** Deteccion de conflictos de N/N: durante el sync, si un arbol N/N fue resuelto localmente Y tambien fue resuelto en el servidor por otro usuario con una especie DIFERENTE, se detecta el conflicto. Se muestra al usuario cuales N/N difieren. El usuario puede ir a la pantalla de resolucion donde ve la especie del servidor, y decide: aceptar la del servidor (descartar la suya) o imponer la suya (re-sincronizar con su eleccion).

### Indicadores visuales N/N
- **D-11:** SubGroupCard: indicador de N/N pendientes usando los 2 colores principales del theme. Sin ensanchar el tamano de la card. Claude elige el mejor formato visual.
- **D-12:** PlantationCard: stat adicional "N/N: X" en la fila de estadisticas, mostrando cantidad total de arboles N/N sin resolver en la plantacion. Mismos colores principales del theme.

### Claude's Discretion
- Punto exacto de deteccion de conflictos de N/N (durante pull o durante push) — elegir el enfoque mas robusto
- Formato visual del indicador de N/N en SubGroupCard (badge, icono, texto compacto)
- UX del flujo de conflicto de N/N: como se presenta la pantalla de resolucion con la opcion del servidor
- Si el RPC necesita cambios menores vs refactoring mayor para aceptar especieId=null
- Manejo de la foto de N/N en el servidor (la foto ya se sube por Phase 12, confirmar que funciona para N/N)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sync core
- `mobile/src/services/SyncService.ts` — syncPlantation(), pullFromServer(), uploadSubGroup(). Linea 607: filtro actual de getSyncableSubGroups que debe cambiar
- `mobile/src/hooks/useSync.ts` — Hook que expone startBidirectionalSync(), startGlobalSync(), startPlantationSync()

### SubGroup & Tree repositories
- `mobile/src/repositories/SubGroupRepository.ts` — getSyncableSubGroups() (filtro N/N a eliminar), finalizeSubGroup(), markSubGroupPendingSync(), markSubGroupSynced()
- `mobile/src/repositories/TreeRepository.ts` — resolveNNTree(), registerTree() con especieId null para N/N

### N/N resolution
- `mobile/src/hooks/useNNResolution.ts` — Hook completo para resolucion de N/N. Soporta modo subgrupo y modo plantacion-wide. Hay que agregar permisos por rol.
- `mobile/src/hooks/useNNFlow.ts` — hasUnresolvedNN, nnCount. Usado en TreeRegistrationScreen
- `mobile/src/hooks/useTrees.ts` — unresolvedNN count
- `mobile/src/queries/plantationDetailQueries.ts` — getNNTreesForPlantation()

### Pending sync counts
- `mobile/src/hooks/usePendingSyncCount.ts` — Ya tiene blockedByNN count. Revisar si sigue siendo necesario post-cambio.

### UI components
- `mobile/src/components/PlantationCard.tsx` — Agregar stat de N/N
- `mobile/src/components/SubGroupCard.tsx` — Agregar indicador N/N (buscar en codebase)
- `mobile/src/components/AdminBottomSheet.tsx` — Gate de finalizacion de plantacion

### Finalization
- `mobile/src/hooks/usePlantationAdmin.ts` — Logica de finalizacion de plantacion por admin. Agregar gate de N/N.

### Supabase RPC
- `supabase/migrations/` — RPC sync_subgroup. Revisar que acepta especieId null.

### Theme
- `mobile/src/theme.ts` — Colores principales para indicadores de N/N. Linea 42: colores yellow/N/N ya definidos.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useNNResolution` hook: Ya soporta modo subgrupo y modo plantacion-wide. Solo necesita extension para permisos por rol (admin ve todos, tecnico solo los suyos).
- `getSyncableSubGroups()`: Simplificar eliminando el filtro de N/N — pasa a devolver todos los finalizados con pendingSync=true.
- `usePendingSyncCount`: Ya calcula `blockedByNN` — este concepto puede desaparecer o reconvertirse en "count de N/N para display".
- `getNNTreesForPlantation()`: Query existente para N/N a nivel plantacion — reutilizable para el stat de PlantationCard.

### Established Patterns
- Sync via RPC `sync_subgroup` con ON CONFLICT DO NOTHING/UPDATE — el re-upload de subgrupo con N/N resuelto usa el mismo patron
- `pendingSync` dirty flag para tracking de cambios locales — la resolucion de N/N ya marca pendingSync=true via resolveNNTree -> markSubGroupPendingSync
- Pull-before-push en bidirectional sync — el punto natural para detectar conflictos de N/N es durante el pull

### Integration Points
- `getSyncableSubGroups()` en SubGroupRepository: eliminar filtro N/N
- `usePlantationAdmin.ts`: agregar gate de N/N en la logica de finalizacion de plantacion
- `AdminBottomSheet`: boton finalizar deshabilitado cuando hay N/N
- `PlantationCard`: nuevo stat "N/N: X"
- `SubGroupCard`: indicador visual de N/N pendientes
- `pullFromServer()` en SyncService: detectar conflictos de N/N al bajar datos del servidor

</code_context>

<specifics>
## Specific Ideas

- "Intenta mantener todo con los 2 colores principales del theme" — no agregar colores nuevos para N/N, usar los existentes
- "Sin ensanchar el tamano de la card del subgrupo" — el indicador de N/N debe ser compacto
- "Debe indicarse cantidad de N/N totales en la card de la plantacion" — stat adicional visible
- El flujo de conflicto de N/N debe ser intuitivo: mostrar que especie eligio el servidor, permitir al usuario aceptar o sobreescribir. Pantalla de resolucion reutilizada con info extra de la especie del servidor.

</specifics>

<deferred>
## Deferred Ideas

- **Sincronizar subgrupos activos:** Permitir sync de subgrupos que no estan finalizados. Fase futura.
- **Reapertura de plantacion finalizada:** Admin reabre plantacion finalizada. Quick task o fase futura.
- **Resolucion de N/N por cualquier tecnico asignado:** Hoy solo admin y tecnico original. Podria ampliarse en el futuro.

</deferred>

---

*Phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo*
*Context gathered: 2026-04-14*
