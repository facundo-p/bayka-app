# Phase 13: Unificar sync bidireccional - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 13-unificar-sync-bidireccional
**Areas discussed:** Sync scope, granularity, dirty flag, visual indicators, photo handling, catalog integration

---

## Plantaciones nuevas del servidor

| Option | Description | Selected |
|--------|-------------|----------|
| A) Solo plantaciones locales | Sync solo sincroniza las que ya tenes localmente. Catalogo sigue aparte. | Yes |
| B) Auto-descargar asignadas | Sync auto-descarga todas las plantaciones asignadas al usuario | |
| C) Detectar y preguntar | Sync detecta nuevas y pregunta antes de descargar | |

**User's choice:** A — Catalogo se mantiene como flujo independiente
**Notes:** None

---

## Scope del sync: por plantacion o global

| Option | Description | Selected |
|--------|-------------|----------|
| A) Sync global | Sincroniza TODAS las plantaciones locales de una sola vez | |
| B) Sync por plantacion | Se mantiene gear por plantacion con un solo boton "Sincronizar" | |
| C) Ambos | Boton global en header + opcion por plantacion | Yes |

**User's choice:** C — Ambos puntos de entrada
**Notes:** None

---

## Fotos: siempre incluir o preguntar

| Option | Description | Selected |
|--------|-------------|----------|
| A) Siempre incluir | Simplificar UX, mas datos transferidos | |
| B) Mantener toggle | Preguntar cada vez en modal de confirmacion | |
| C) Setting persistente | Configurar una vez, aplicar siempre | Yes |

**User's choice:** C — Setting persistente
**Notes:** None

---

## Catalogo

| Option | Description | Selected |
|--------|-------------|----------|
| A) Mantener separado | Sync unificado es solo para datos ya descargados | Yes |
| B) Integrar | Al sincronizar, tambien descargar plantaciones nuevas asignadas | |

**User's choice:** A — CatalogScreen sigue independiente
**Notes:** None

---

## Granularidad del dirty flag

| Option | Description | Selected |
|--------|-------------|----------|
| A) Solo subgrupo | subgroups.pendingSync boolean. Cualquier cambio local lo marca true. | Yes |
| B) Subgrupo + arbol | Dos niveles de dirty flag. Requiere nuevo RPC para updates parciales. | |
| C) Solo arbol | Maxima granularidad pero queries de agregacion mas pesadas. | |

**User's choice:** A — Solo a nivel subgrupo
**Notes:** Se analizo trafico de datos. Subgrupos son ~20KB (JSON ligero). Fotos ya tienen fotoSynced aparte. El RPC actual sync_subgroup ya envia subgrupo + todos los arboles atomicamente, asi que el dirty flag por subgrupo matchea el patron existente.

---

## Modelo de estados y dirty flag

**User's choice:** Eliminar "sincronizada" como estado de subgrupo. Estados: activa -> finalizada. Dirty flag (pendingSync) ortogonal al estado. Inmutabilidad solo determinada por plantacion finalizada, no por subgrupo.
**Notes:** Prepara para futuro: sincronizar subgrupos activos. Admin podra reabrir plantaciones finalizadas (funcionalidad nueva, deferred).

---

## Indicadores visuales

**User's choice:** Orange dot reemplaza chip "Sincronizado". Color centralizado en theme.ts. Aparece en PlantationCard, SubGroupCard, e icono de sync global. Ausencia de dot = todo al dia.
**Notes:** "La fuente de verdad del color del orange dot este centralizado — si se cambia para uno se cambia para todos" (cita directa del usuario).

---

## Progreso y errores parciales

**User's choice:** A definir durante planning
**Notes:** None

---

## Claude's Discretion

- Flujo exacto del SyncProgressModal para progreso bidireccional
- UX de configuracion del setting de fotos
- Estrategia de rollback ante fallos parciales

## Deferred Ideas

- Sincronizar subgrupos activos y con N/N (fase futura)
- Reapertura de plantacion finalizada por admin (quick task o fase futura)
