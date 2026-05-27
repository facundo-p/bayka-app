# Phase 16 — Plan Check Report

**Reviewed:** 2026-05-19
**Scope:** 16-01-PLAN.md (rename), 16-02-PLAN.md (Parcela data layer), 16-03-PLAN.md (sync)
**Reviewer:** gsd-plan-checker (goal-backward)

## Verdict

**PASS-WITH-NOTES**

The three plans, executed in order (01 → 02 → 03), substantively achieve the 8 ROADMAP success criteria for Phase 16. Coverage of the 19-file D-16 scope is complete, FK ordering is explicit, conflict handling preserves `pending_sync`, OrangeDot propagation is planned, and CLAUDE.md §9 is respected. Several non-blocking items deserve attention before execution — none threaten the phase goal, but they would tighten quality and remove ambiguities.

## Coverage Matrix

| SC# | ROADMAP Success Criterion | Covered by | Status |
|-----|---------------------------|------------|--------|
| 1 | App compila, 0 referencias residuales `SubGroup`/`subgrupo` en código | 16-01 Tasks 1.1–1.8 (gate: `tsc --noEmit` = 0 + grep audit) | COVERED |
| 2 | `ParcelaRepository` CRUD + unicidad nombre/codigo + `descripcion ≤10.000` + delete bloqueado por hijos | 16-02 Task 2.1 (helpers `validateParcelaUniqueness`, `validateDescripcion`, `delete` con `has_children`) | COVERED |
| 3 | `parcelaQueries` con conteo grupos/árboles reutilizable (CLAUDE.md §9) | 16-02 Task 2.2 (`listByPlantacionWithStats`, `countGroupsByParcela`, `countTreesByParcela`) | COVERED |
| 4 | `useParcelas(plantacionId)` reactivo vía `useLiveData` | 16-02 Task 2.3 | COVERED |
| 5 | Sync parcelas online (pull/push) + offline (creada offline aparece tras reconectar) | 16-03 Tasks 3.1 (pull), 3.2 (push), 3.5 (E2E test) | COVERED |
| 6 | Conflict detection unicidad → error claro + `pending_sync=true` persiste | 16-03 Task 3.2 (`classifyParcelaRpcResult`, `DUPLICATE_CODE`/`DUPLICATE_NAME`, no `markSynced` en error) | COVERED |
| 7 | Tests unitarios + integración SQLite real verdes | 16-02 Task 2.4 + 16-03 Task 3.5 (`parcela-sync.test.ts` con 6 escenarios) | COVERED |
| 8 | Tests existentes adaptados con cobertura ≥ pre-rename | 16-01 Task 1.7 (`grep -c "expect("` pre/post, conteo en commit) | COVERED |

**19 archivos D-16 (Plan 16-01 explicit touch):** Verificado — `files_modified` del 16-01 incluye los 2 hooks, 6 queries, 3 repositories (con rename), 3 services, 5 tests integración. **TODOS los 19 enumerados están listados.**

## Findings

### 1. **[WARN]** `generateSubId` placeholder `''` para `parcelaCodigo` es deuda explícita pero peligrosa en runtime
- **Plan 16-01 Task 1.4** documenta el placeholder con `// PHASE-17:` y archivo `tasks/16-01-deuda-phase17.md`. Bueno.
- **Riesgo:** Si Phase 17 se retrasa o un usuario crea árboles en la app entre P16 y P17, los SubIDs generados quedarán **persistidos en SQLite y subidos al server** sin prefijo de parcela. Esto contamina la tabla `trees` con SubIDs malformados que **luego habrá que rebuildear**. Plan 16-01 Risk #3 lo reconoce como "detectable en QA" pero NO bloquea el push al server.
- **Fix sugerido:** Agregar a Task 1.4 una guardia runtime: si `parcelaCodigo === ''` en `generateSubId`, lanzar `throw new Error('PHASE-17: parcelaCodigo missing — registro de árboles bloqueado hasta Phase 17')` o al menos un `console.warn` + flag de feature lock. Alternativa: bloquear creación de árboles en UI con un banner "Esperando Phase 17" hasta que el cableado esté completo. Decisión del usuario.

### 2. **[WARN]** Plan 16-01 Task 1.4: SQL raw embebido en repositories debe pasar a `groups`
- Task 1.4 menciona `DELETE FROM subgroups WHERE plantacion_id = ?` y `sql\`... FROM subgroups ...\`` en `PlantationRepository`. Esto es correcto pero el plan **no enumera** los call-sites raw exactos. Si hay un `sql\`...\`` en otro archivo de queries (e.g., `dashboardQueries.ts` o `exportQueries.ts` con strings SQL crudos), podría escaparse del rename y romper en runtime sin que tsc lo detecte (los strings SQL no son tipados).
- **Fix sugerido:** Agregar a Task 1.1 un grep específico: `grep -rn "FROM subgroups\|JOIN subgroups\|UPDATE subgroups\|DELETE FROM subgroups\|INTO subgroups" mobile/src` y categorizarlos como "identifier" obligatorios.

### 3. **[WARN]** Plan 16-02 Task 2.1: ambigüedad sobre `delete` sync
- Risk #2 reconoce explícitamente la deuda: el delete físico local no se propaga al server. Esta deuda se "documenta en `tasks/16-02-deuda-delete-sync.md`" y se difiere a Phase 18.
- **Problema:** Si un usuario borra una parcela localmente y luego un sync pull (Task 3.1) la trae de vuelta del server, **el usuario va a verla reaparecer "mágicamente"** — confusión UX. Plan 16-03 Risk #3 reconoce esto pero lo descarga al copy de UI en Phase 17.
- **Fix sugerido:** Tomar decisión explícita ahora — o (a) marcar la parcela con `deleted_at` local (soft-delete) y enviar al pull lógica `WHERE id NOT IN (SELECT id FROM parcelas_tombstones)`, o (b) bloquear UI delete cuando hay conexión hasta Phase 18. Documentar la decisión en CONTEXT.md como D-16-19.

### 4. **[WARN]** Plan 16-03 Task 3.2: error parsing de Supabase es heurística frágil
- El plan detecta `'parcelas_plantation_code_unique'` por substring matching en el mensaje de error. Risk #1 reconoce que el error code de Supabase puede no contener el nombre exacto del constraint.
- **Fix sugerido:** Antes de implementar, ejecutar un spike de 10 min: provocar el conflict en dev contra el server real y capturar el shape exacto del error (postgres code `23505`, `details`, `message`, `hint`). Anclar el classifier al `code === '23505'` + parsing del `details` field (`Key (plantation_id, codigo)=(uuid, 'LP1') already exists.`), que es estable.

### 5. **[NIT]** Plan 16-01 Task 1.5: strings de error en `types.ts` ERROR_MESSAGES
- El plan dice "mantener el texto 'subgrupo'" + TODO. Correcto — son user-facing strings (Phase 17).
- **Sugerencia:** Centralizar todos los `// PHASE-17:` comments en un único archivo `tasks/16-01-phase17-debt.md` con grep + paths exactos, así Phase 17 no tiene que re-grepear.

### 6. **[NIT]** Plan 16-02 Task 2.4: `useParcelas.test.ts` usa Jest module mock pero no especifica el harness
- El proyecto usa Vitest (per memoria de feedback). Verificar si el harness es `vi.mock` o `jest.mock`. No es bloqueante pero el código del test debe usar la API correcta.

### 7. **[NIT]** Plan 16-03 Task 3.4: `usePendingSyncCount` con 3-4 queries reactivas
- Risk #5 ya reconoce el risk de re-render storm. La mitigación (`useLiveData` ya tiene debounce) es razonable.
- **Sugerencia:** Extraer la agregación a `pendingSyncQueries.ts` desde el inicio (no como contingencia), eliminando duplicación entre el hook actual y el extendido.

### 8. **[NIT]** Plan 16-01 Task 1.7: factories.ts en `mobile/tests/helpers/` puede no existir
- El plan dice "si existe `createTestSubGroup`". Verificar previo a la ejecución; si no existe, omitir el step. Bueno que esté en condicional.

### 9. **[OK — observación]** Branch invariant respetado
- Ningún plan crea ni cambia de branch. CONTEXT.md confirma que Phase 16 vive en la misma branch que Phase 15 (`feat/v1.1-schema-and-rename`). CONFORME con memoria `feedback_use_branches.md`.

### 10. **[OK — observación]** CLAUDE.md §9 respetado
- 16-02 Task 2.3 explícitamente prohíbe SQL en `useParcelas.ts`.
- 16-02 Verification step #3 grep verifica `db.\(select\|insert\|update\|delete\)` solo en queries/repos, nunca en hooks.
- 16-03 Task 3.4 menciona que si la query crece, mover a `parcelaQueries.ts` o `pendingSyncQueries.ts` — explícito.
- **Riesgo residual:** Plan 16-03 Task 3.4 actualmente acepta `useLiveData` con SQL inline en el hook si la query es simple ("UNION ALL"). Lectura literal de CLAUDE.md §9 dice "cero queries en hooks". **Sugerencia:** desde el inicio, mover la query a `pendingSyncQueries.ts`, dejando `usePendingSyncCount.ts` solo como orquestador.

### 11. **[OK]** Cross-plan dependencies declaradas y consistentes
- 16-02 `depends_on: [16-01]` ✓
- 16-03 `depends_on: [16-01, 16-02]` ✓ (incluye 16-01 redundantemente — está bien, es transitivo)

### 12. **[OK]** FK ordering invariant explícito
- 16-03 Task 3.1 (pull): orden `pullParcelas → pullGroups` documentado.
- 16-03 Task 3.2 (push): `uploadSyncableParcelas` ANTES de `uploadSyncableGroups`.
- 16-03 Task 3.5 escenario 6 y 7 explícitamente testean el orden FK en pull y push.

### 13. **[OK]** `pending_sync` no se limpia en conflict
- 16-03 Task 3.2: "**solo se limpia `pending_sync` en éxito**". Cumple memoria `feedback_state_lifecycle_audit.md`.
- 16-03 Task 3.5 escenario 3 y 4 lo testean explícitamente.

### 14. **[OK]** OrangeDot propagation planificado
- 16-03 Task 3.4 actualiza `usePendingSyncCount` con conteo de parcelas, e incluye verificación cross-plantación.

### 15. **[OK]** Tests adecuados para SC#7 y SC#8
- 16-02 Task 2.4: 13 escenarios de `ParcelaRepository` + 3 de `parcelaQueries` + 3 de `useParcelas`.
- 16-03 Task 3.5: 6+ escenarios de integración E2E con SQLite real.
- 16-01 Task 1.7: conteo de assertions pre/post documentado en commit.

### 16. **[OK]** Tasks atómicas
- Cada task tiene Files, What, Why, Verification claros. Ninguno excede ~50 líneas ni hace más de un cambio lógico atómico.

### 17. **[OK]** Identifier-only renames en screens/components
- 16-01 Task 1.6 enfatiza varias veces "NO tocar JSX renderizado", agrega TODO comments por archivo, y deja la ruta `nuevo-subgrupo` intacta. Cumple D-16-02.

## Recommendations

Antes de ejecutar 16-01 → 16-02 → 16-03, el planner debería:

1. **Resolver Finding #1 (BLOCKER suave):** Decidir entre runtime guard (`throw`) o feature-lock en UI durante el placeholder `parcelaCodigo=''`. Agregar a Task 1.4.
2. **Resolver Finding #3 (BLOCKER suave):** Decidir política de delete cross-device — soft-delete con tombstones, o bloqueo UI hasta Phase 18. Documentar como D-16-19 en CONTEXT.md.
3. **Resolver Finding #4:** Ejecutar spike de 10 min para capturar el shape exacto del error de Supabase (postgres 23505 + details), y anclar el classifier en lugar de hacer substring matching frágil. Actualizar Task 3.2 con el shape capturado.
4. **Aplicar Finding #2:** Agregar grep de SQL raw (`FROM subgroups`, `JOIN subgroups`, etc.) a Task 1.1 como categoría explícita.
5. **Aplicar Finding #10:** Mover la query de `usePendingSyncCount` a `pendingSyncQueries.ts` desde el inicio (no como contingencia). Task 3.4 update.

NITs (5, 6, 7, 8) pueden resolverse durante ejecución sin replan.

## Strengths

- **Goal-backward coverage:** Los 8 success criteria del ROADMAP están explícitamente mapeados en cada plan, con SC# anotado en cada checkbox.
- **D-16 19-file scope:** Todos los archivos enumerados están en `files_modified` de 16-01 y desglosados por task con la categorización (hooks/queries/repos/services/tests).
- **Atomic Grupo invariant:** 16-03 Task 3.3 trata el case edge donde una parcela pendiente bloquea su grupo dependiente sin romper la atomicidad del RPC.
- **CLAUDE.md compliance:** §3 (≤20 líneas) y §9 (cero SQL en hooks/screens) están explícitamente verificados en steps de cada plan.
- **Memoria usage:** Múltiples lecciones (state-lifecycle-audit, refactor-audit, atomic-functions, spanish-naming, android-only) referenciadas con cita por nombre, no sólo aludidas.
- **TDD-friendly:** Tests definidos antes/con la implementación (16-02 Task 2.4 lista 13 cases concretos; 16-03 Task 3.5 lista 7 escenarios E2E).
- **Risk register:** Cada plan tiene una sección Risks & Mitigations explícita y honesta (no es soft).
