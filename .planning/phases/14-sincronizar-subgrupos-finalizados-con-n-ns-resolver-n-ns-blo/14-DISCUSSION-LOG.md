# Phase 14: Sincronizar subgrupos finalizados con N/Ns - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
**Areas discussed:** Sync de N/N al servidor, Gate de finalizacion, Resolucion remota de N/N, Indicadores visuales N/N

---

## Sync de N/N al servidor

| Option | Description | Selected |
|--------|-------------|----------|
| Sincronizar con N/N | Subgrupos finalizados con N/N se sincronizan normalmente. Arbol sube con especieId=null. | ✓ |
| Sincronizar con warning | Igual pero con aviso previo al usuario | |
| Opcion por subgrupo | El usuario elige cuales subgrupos con N/N sincronizar | |

**User's choice:** Sincronizar con N/N — sin warning, silenciosamente.

| Option | Description | Selected |
|--------|-------------|----------|
| Ajustar RPC | Revisar y ajustar sync_subgroup para aceptar especieId=null | ✓ |
| Tu decides | Claude investiga y decide | |

**User's choice:** Ajustar RPC — revisar el RPC existente.

---

## Gate de finalizacion

| Option | Description | Selected |
|--------|-------------|----------|
| Finalizacion de plantacion | Admin no puede finalizar plantacion si hay N/N pendientes. Subgrupos si se pueden finalizar con N/N. | ✓ |
| Finalizacion de subgrupo | Tecnico no puede finalizar subgrupo con N/N | |
| Ambos niveles | Ni subgrupo ni plantacion con N/N | |

**User's choice:** Finalizacion de plantacion — gate solo a nivel plantacion.

| Option | Description | Selected |
|--------|-------------|----------|
| Boton deshabilitado + mensaje | Boton 'Finalizar' deshabilitado con texto: 'X N/N sin resolver en Y subgrupos' | ✓ |
| Alert al intentar | Boton habilitado, alert al tocar | |
| Tu decides | Claude elige UX | |

**User's choice:** Boton deshabilitado + mensaje explicativo.

---

## Resolucion remota de N/N

| Option | Description | Selected |
|--------|-------------|----------|
| Solo admin | Solo admin resuelve N/N de otros | |
| Cualquier tecnico asignado | Cualquier tecnico de la plantacion puede resolver | |
| Admin y tecnico original | Admin resuelve cualquier N/N, tecnico solo los de sus subgrupos | ✓ |

**User's choice:** Admin y tecnico original.

| Option | Description | Selected |
|--------|-------------|----------|
| Mantener acceso actual | Desde subgrupo o modo plantacion-wide | ✓ |
| Agregar acceso desde gear | Opcion adicional en AdminBottomSheet | |
| Tu decides | Claude elige | |

**User's choice:** Mantener acceso actual — no agregar entrada nueva.

| Option | Description | Selected |
|--------|-------------|----------|
| Sync regular | Resolucion marca pendingSync=true, se sube en proximo sync | ✓ (con extension) |
| Sync inmediato parcial | Se sube inmediatamente al servidor | |
| Tu decides | Claude elige | |

**User's choice:** Sync regular, pero con deteccion de conflictos. Si al sincronizar un N/N resuelto localmente el servidor ya tiene otra resolucion (especie diferente), mostrar conflicto al usuario. El usuario puede aceptar la del servidor o imponer la suya desde la pantalla de resolucion de N/N.

| Option | Description | Selected |
|--------|-------------|----------|
| Detectar en pull | Comparar durante pullFromServer | |
| Detectar en push | RPC compara y devuelve conflictos | |
| Tu decides | Claude elige punto de deteccion mas robusto | ✓ |

**User's choice:** Claude decide — lo importante es que se detecten los conflictos.

---

## Indicadores visuales N/N

**User's choice (SubGroupCard):** Tu decides, pero mantener los 2 colores principales del theme, sin ensanchar la card.

**User's choice (PlantationCard):** Stat adicional "N/N: X" en la fila de estadisticas.

---

## Claude's Discretion

- Punto de deteccion de conflictos N/N (pull vs push)
- Formato visual del indicador N/N en SubGroupCard
- UX del flujo de conflicto de N/N
- Ajustes al RPC sync_subgroup

## Deferred Ideas

- Sincronizar subgrupos activos
- Reapertura de plantacion finalizada
- Resolucion de N/N por cualquier tecnico asignado
