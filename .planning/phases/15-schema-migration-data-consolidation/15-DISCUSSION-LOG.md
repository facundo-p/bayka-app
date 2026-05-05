# Phase 15: Schema migration + data consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 15-schema-migration-data-consolidation
**Areas discussed:** Coordinación de despliegue, Mapping plantación→Parcela, Rollback y validación, Re-sync local + Drizzle rename

---

## Coordinación de despliegue

### Q1: Orden de migración Supabase vs release del cliente

| Option | Description | Selected |
|--------|-------------|----------|
| Server primero, luego release del cliente | Aplica 012+013 con app inactiva, después publicar APK. Pro: data ya consistente; contra: usuarios con app vieja ven errores hasta actualizar. | |
| Cliente primero, luego server | Publicar APK nuevo con schema local nuevo, server sigue viejo. Riesgo alto: sync roto. | |
| Window coordinado simultáneo | Anuncio explícito al equipo (4 técnicos): no sincronizar entre HH:MM. Server primero, mismo window release del APK. | ✓ |

**User's choice:** Window coordinado simultáneo
**Notes:** El equipo es chico (4 técnicos), la coordinación humana es viable.

### Q2: Protección contra cliente viejo durante el window

| Option | Description | Selected |
|--------|-------------|----------|
| schema_version gate en RPC sync_subgroup | Parámetro `client_schema_version`. Cliente viejo recibe error claro. | |
| Confiar en el window humano | Sin gate técnico. Si alguien no actualiza, sync falla con error genérico. | ✓ |
| Pausar RLS / revocar policies durante window | Quitar permisos durante migración, restaurar después. | |

**User's choice:** Confiar en el window humano
**Notes:** Aceptación explícita del trade-off.

### Q3: Pull vs push tras la migración

| Option | Description | Selected |
|--------|-------------|----------|
| Pull primero, luego push | Cliente baja la nueva estructura, reemplaza local; después push pendiente. Coherente con Phase 13. | ✓ |
| Push primero, luego pull | Sube pendiente local primero — pero cliente no sabe parcela_id de subgroups locales. Frágil. | |
| Solo pull, descartar pending_sync local | Asumir que pre-window se vacía. Si queda algo, se pierde. | |

**User's choice:** Pull primero, luego push
**Notes:** Consistente con bidireccional ya establecido.

### Q4: Pre-condición del window

| Option | Description | Selected |
|--------|-------------|----------|
| Exigir sync limpio antes del window | Anuncio: "sincronicen todo lo pendiente antes". Reduce riesgo. | ✓ |
| Aceptar pending_sync local, manejar post-migración | Más tolerante pero mapeos manuales requeridos. | |
| Window tras producción estabilizada (sin field activo) | Aprovechar que aún no empezó la temporada Otoño 2026. | |

**User's choice:** Exigir sync limpio antes del window

---

## Mapping plantación→Parcela

### Q1: Cómo se especifica el mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Tabla explícita en el SQL 013 | VALUES con (source_plantation_id, target_parcela_codigo). 21 filas concretas, auditable. | ✓ |
| Inferir por nombre original | Pattern match `SSS-LOMA-P%`. Menos líneas pero edge cases ocultos. | |
| Archivo .csv/json externo | Mapping en archivo separado importado por script. Dependencia runtime extra. | |

**User's choice:** Tabla explícita en el SQL 013

### Q2: Generación del mapping concreto

| Option | Description | Selected |
|--------|-------------|----------|
| Generarlo ahora antes del SQL | Auditoría a Supabase: id+nombre+lugar+counts. Documentado y revisado por usuario antes del SQL. | ✓ |
| Ya existe en docs/ | Indicar dónde para que research lo localice. | |
| Lo genera el research agent en próxima fase | Diferir; research conecta a Supabase. Riesgo: credenciales productivas. | |

**User's choice:** Generarlo ahora antes del SQL

### Q3: Documentación del mapping

| Option | Description | Selected |
|--------|-------------|----------|
| supabase/migrations/data/015_consolidation_mapping.md | Markdown versionado con tabla origen→destino + query auditoría + checksums. | ✓ |
| Inline en SQL 013 como comentarios | Una sola fuente pero PR enorme. | |
| GitHub Issue/PR comment | No persiste si la PR se squashea. | |

**User's choice:** supabase/migrations/data/015_consolidation_mapping.md

### Q4: Manejo de edge cases en la auditoría

| Option | Description | Selected |
|--------|-------------|----------|
| Abortar y consultar antes de proceder | Cualquier desviación frena el plan. | ✓ |
| Documentar excepciones y continuar | Anotar en mapping md como excepción firmada por usuario. | |
| Auto-asignar a parcela default por cluster | Si no encaja, default Loma-P1 / Selva Original / La Morita. Contamina datos. | |

**User's choice:** Abortar y consultar antes de proceder

---

## Rollback y validación

### Q1: Unidad transaccional del SQL 013

| Option | Description | Selected |
|--------|-------------|----------|
| Una sola transacción BEGIN..COMMIT | Todo o nada, ROLLBACK automático ante error. | ✓ |
| Transacción por cluster (3 transacciones) | Aísla fallas pero deja inconsistencia parcial. | |
| Sin transacción; statements secuenciales | Recovery manual obligatorio. No recomendado. | |

**User's choice:** Una sola transacción BEGIN..COMMIT

### Q2: Nivel de validación post-migración

| Option | Description | Selected |
|--------|-------------|----------|
| Conteos + muestreo de SubIDs | Conteos exactos + 5-10 árboles muestreados. | |
| Solo conteos | 3/21/225/N + ningún SubID NULL + ningún huérfano. | |
| Validación exhaustiva (todos los SubIDs) | Calcular SubID esperado para cada uno y comparar. Máxima confianza. | ✓ |

**User's choice:** Validación exhaustiva (con nota de re-confirmar el conteo total: 6.776 vs ~7000 mencionado en análisis previo)
**Notes:** El número exacto de árboles preservados se re-confirma en la auditoría. Genera nueva preocupación: discrepancia 6.776 vs ~7000. Pregunta de seguimiento (Q3) cubre esto.

### Q3: Resolución de la discrepancia de conteo

| Option | Description | Selected |
|--------|-------------|----------|
| Auditoría re-confirma el número antes del SQL | La query es source of truth; actualiza REQUIREMENTS y ROADMAP. | ✓ |
| Asumir 6.776 + validar; si difiere, abortar | Mantener cifra, fallar si no coincide. | |
| Aceptar rango (6.500–7.000) y registrar el real | Menos estricto, útil si hubo árboles agregados después del análisis original. | |

**User's choice:** Auditoría re-confirma el número antes del SQL

### Q4: Recovery playbook

| Option | Description | Selected |
|--------|-------------|----------|
| ROLLBACK basta + investigar + retry | Postgres garantiza estado pre-013. Backup R2 como seguro extra. | ✓ |
| Restore desde backup R2 si ROLLBACK no es suficiente | Documentar procedimiento para casos atípicos. | |
| Aplicar 012 y 013 con backup intermedio | Más pasos, más seguro pero overkill para este caso. | |

**User's choice:** ROLLBACK basta + investigar + retry

---

## Re-sync local + Drizzle rename

### Q1: Drizzle migration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Recreate-table pattern de SQLite | CREATE groups → INSERT SELECT → DROP subgroups → recrear índices. Generado por drizzle-kit. | ✓ |
| Drop subgroups + re-pull desde server | Más simple pero pierde data offline pendiente. | |
| ALTER TABLE RENAME nativo + columnas adicionales | SQLite 3.35+ soporta. Índices únicos requieren DROP+CREATE. | |

**User's choice:** Recreate-table pattern de SQLite

### Q2: Actualización de SubIDs locales

| Option | Description | Selected |
|--------|-------------|----------|
| Pull bidireccional re-baja árboles del server | Mecanismo de Phase 13 reemplaza con SubIDs nuevos. Sin lógica adicional en cliente. | ✓ |
| Truncate trees local + full pull | Predecible pero descarga grande. | |
| UPDATE local con generateSubId + parcela_id | Complejo y frágil. | |

**User's choice:** Pull bidireccional re-baja árboles del server

### Q3: Estrategia de idGenerator entre Phase 15 y 16

| Option | Description | Selected |
|--------|-------------|----------|
| Firma vieja eliminada, build rompe hasta Phase 16 | Una sola fuente de verdad. App no compila durante el gap. | ✓ |
| Wrapper deprecated con warning | Compila durante el gap. Riesgo de uso accidental de firma vieja. | |
| Dejar firma vieja en Phase 15, romper en Phase 16 | Cada phase mantiene compilación verde. | |

**User's choice:** Firma vieja eliminada, build rompe hasta Phase 16

### Q4: Manejo del gap de compilación P15→P16

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 15 + 16 en la misma branch/PR | Branch única `feat/v1.1-schema-and-rename`, ambas viajan juntas. | ✓ |
| Branch separada por phase, merge solo cuando P16 lista | Disciplina manual de no mergear P15 sola. | |
| Skip flag — Phase 15 mergea con tests deshabilitados | Viola regla de build verde. No recomendado. | |

**User's choice:** Phase 15 + 16 en la misma branch/PR

---

## Claude's Discretion

- Forma exacta del verification SQL (mismo `013_*.sql` con `RAISE EXCEPTION` vs script `.sql` separado post-COMMIT)
- Ubicación de la query de auditoría pre-mapping (script en `scripts/`, notebook, o queries inline en `015_consolidation_mapping.md`)
- Renombrar vs DROP+CREATE de los índices únicos viejos de subgroups
- Ejecución del SQL 012/013 en server (dashboard SQL editor vs supabase CLI vs script Node)
- Manejo de `tipo='parcela'` legacy (REQUIREMENTS dice 0 filas; auditoría confirma)
- Retención de columna `subgroup_id` legacy en `trees` (rename directo a `group_id` sin columna paralela)

## Deferred Ideas

- Gate `client_schema_version` en RPC sync_subgroup (descartado para Phase 15)
- Backup intermedio entre 012 y 013 (descartado)
- Wrapper deprecated en idGenerator (descartado)
- Pattern matching de nombres para mapping (descartado)
- Restauración offline de pending_sync post-migración (fuera de scope)
