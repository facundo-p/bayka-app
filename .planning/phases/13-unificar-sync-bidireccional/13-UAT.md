---
status: diagnosed
phase: 13-unificar-sync-bidireccional
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md, 13-03-SUMMARY.md]
started: 2026-04-14T12:00:00Z
updated: 2026-04-14T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Single Sincronizar Button
expected: En la pantalla de detalle de plantacion, hay un unico boton "Sincronizar" en lugar de botones separados Descargar/Subir.
result: pass

### 2. Per-Plantation Sync from Gear Menu
expected: Al tocar el engranaje en una PlantationCard y seleccionar "Sincronizar", se sincroniza SOLO esa plantacion (no todas). El modal de progreso muestra solo la actividad de esa plantacion.
result: pass

### 3. Global Sync from Header
expected: En PlantacionesScreen, el icono de sync en el header (circulo verde con icono sync) sincroniza TODAS las plantaciones locales. El modal muestra progreso por plantacion ("Sincronizando [nombre]... 1 de N plantaciones").
result: pass

### 4. Orange Ring Indicator on Global Sync
expected: Cuando hay datos pendientes de sync, el boton de sync global en el header tiene un borde naranja. Cuando todo esta sincronizado, el borde desaparece (es transparente).
result: pass

### 5. Orange Dot on PlantationCard
expected: Cuando una plantacion tiene subgrupos con cambios pendientes, aparece un punto naranja a la izquierda del nombre de la plantacion en la card. Cuando todo esta sincronizado, el punto desaparece.
result: pass

### 6. Orange Dot on SubGroupCard
expected: En PlantationDetailScreen, cada SubGroupCard que tiene pendingSync=true muestra un punto naranja inline junto al nombre. Subgrupos ya sincronizados no muestran punto.
result: pass

### 7. Orange Dot Appears After Tree Registration
expected: Al registrar un arbol nuevo, el punto naranja aparece inmediatamente en el SubGroupCard y en la PlantationCard correspondiente (sin necesidad de recargar).
result: pass

### 8. Orange Dot Clears After Sync
expected: Despues de sincronizar exitosamente, los puntos naranjas desaparecen de los SubGroupCards y PlantationCards que se sincronizaron. El anillo naranja del header desaparece si no quedan datos pendientes.
result: pass

### 9. Persistent Photo Toggle
expected: El toggle "Incluir fotos" recuerda su valor entre sesiones. Si lo desactivas, cierras la app, y volves a abrir, sigue desactivado.
result: issue
reported: "El checkbox de incluir fotos no aparece en la sincronizacion general (global sync desde header) ni en la sincronizacion por plantacion (desde gear menu). Solo existe en PlantationDetailHeader pero no se muestra en esos flujos."
severity: major

### 10. SyncProgressModal Phases
expected: Durante la sincronizacion, el modal muestra fases en orden: "Actualizando datos..." (pull), "Subiendo subgrupos..." (push), "Subiendo fotos..." / "Descargando fotos..." (si fotos habilitadas), "Sincronizacion completa" o "Sincronizacion parcial" al final.
result: pass

### 11. No Sincronizada Filter Chip
expected: En PlantationDetailScreen, los chips de filtro de subgrupos solo muestran "Activas" y "Finalizadas". No hay chip "Sincronizadas".
result: pass

### 12. AdminBottomSheet Sync Action
expected: Al tocar el engranaje en una PlantationCard, el bottom sheet tiene accion "Sincronizar" con icono sync-outline. Sin conexion, la accion esta deshabilitada con texto "Necesitas conexion a internet".
result: pass

### 13. Sync Disabled When Offline
expected: En modo avion, el boton de sync global en el header no es visible. La accion "Sincronizar" en el bottom sheet aparece deshabilitada.
result: pass

## Summary

total: 13
passed: 12
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "El toggle 'Incluir fotos' debe estar visible y funcionar en la sincronizacion global (header) y en la sincronizacion por plantacion (gear menu)"
  status: failed
  reason: "User reported: El checkbox de incluir fotos no aparece en la sincronizacion general ni en la sincronizacion por plantacion. Solo existe en PlantationDetailHeader pero no se muestra en esos flujos."
  severity: major
  test: 9
  artifacts: []
  missing: []
