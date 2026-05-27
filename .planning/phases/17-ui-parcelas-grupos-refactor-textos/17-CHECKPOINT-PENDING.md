# Phase 17 — Visual Checkpoint Pending (Task 3.12, D-17-22)

**Status:** BLOCKED on user — requires manual verification on Android device.

**Why this file exists:** Plan 17-03 Task 3.12 is a `checkpoint:human-verify`
gate. The executor (autonomous overnight run) cannot drive a physical device,
so it committed all code-complete state through Task 3.11 and stops here.

All preconditions for the checkpoint are satisfied:

- ✅ `tsc --noEmit` clean
- ✅ Jest: 353 pass / 13 fail (all 13 are pre-existing sync-suite failures
       tracked in `deferred-items.md`; no 17-03 regressions)
- ✅ `grep -rn "subgrupo|Subgrupo|subgrupos|Subgrupos" mobile/src mobile/app` → 0 matches
- ✅ `grep -rn "nuevo-subgrupo" mobile/src mobile/app mobile/tests` → 0 matches
- ✅ All 11 code/doc tasks (3.1 – 3.11) committed atomically on branch
       `gsd/v1.1-phase-15-context`

---

## 16-Step Manual Verification Flow (sin guantes — D-17-22)

Build a debug APK / dev client and run on Android device. For each step,
verify the bullet criteria; report any failures with screenshot or repro.

1. **Login** como técnico → aterriza en `PlantacionesScreen` ("Mis plantaciones").
2. **Verificar PlantationCard:** se ve la fila inferior "Parcelas: N" con
   chevron a la derecha. Sin strings "subgrupo" visibles.
3. **Tap en chevron** → card se expande con animación suave (~250ms); muestra
   lista de `ParcelaRow` inline. Sin textos viejos.
4. **Tap en una `ParcelaRow` inline** → navega a screen de grupos filtrados;
   title del header muestra `"{ParcelaNombre} — Grupos"`; header tiene icono
   `+` a la derecha; NO hay botón inferior "Nuevo subgrupo"; lista muestra
   solo grupos de esa parcela.
5. **Tap en `+`** del header → abre `NuevoGrupoScreen` con title "Nuevo grupo";
   section title "Datos del grupo"; botón "Crear grupo".
6. **Crear un grupo** "Test-G-1"/"TG1" → vuelve al detail screen filtrado, el
   nuevo grupo aparece en la lista.
7. **Tap atrás** → vuelve a `PlantacionesScreen`; card sigue expandido (estado
   local persiste mientras el componente vive) o colapsado al recrearse
   (D-17-13 — aceptable).
8. **Tap en BODY del card** (no chevron) → navega a `ParcelasScreen` con
   title "Parcelas — {Lugar}"; lista con todas las parcelas; header con `+`.
9. **Tap en `+`** de `ParcelasScreen` → modal full-screen con campos
   Nombre/Código/Descripción + contador "0 / 10000".
10. **Escribir descripción >9000 chars** → contador en color warning.
11. **Crear parcela** con código duplicado → error inline en el campo
    correspondiente.
12. **Long-press en una `ParcelaRow`** → modal edit con datos pre-llenados;
    botón "Eliminar parcela" abajo.
13. **Intentar eliminar parcela con grupos** → modal de error "No se puede
    borrar la parcela porque tiene N grupos asociados".
14. **Verificar otros screens** (TreeRegistration, AdminBottomSheet,
    SyncProgressModal): sin string "subgrupo" visible. Mensajes dicen "grupo".
15. **Tap en empty state** (si hay plantación sin parcelas) → CTA "Crear
    primera parcela" abre el modal.
16. **Sync** (icono sync en header) → modal de progreso usa "grupo(s)"; no
    aparecen strings "subgrupo".

---

## How to mark this checkpoint complete

When all 16 steps pass:

1. Delete this file: `rm .planning/phases/17-ui-parcelas-grupos-refactor-textos/17-CHECKPOINT-PENDING.md`
2. Create `17-CHECKPOINT-DONE.md` in the same folder with:
   - `Approved: YYYY-MM-DD by <name>`
   - Any deviations noted during the manual run.
3. Commit: `docs(17-03): Task 3.12 — visual checkpoint approved`.
4. Run `/gsd-execute-phase` continuation (or proceed to Phase 17 SUMMARY +
   ROADMAP update).

If any step fails, file a gap-closure plan (17-04) describing the regression
and the minimal fix; do NOT bypass the checkpoint.

---

## Rollback note (route rename)

If step 5/6 fails with a 404 on `/plantation/nuevo-grupo` (e.g., expo-router
cache pinned to the old slug on the device):

```bash
git revert <hash-of-Task-3.9-commit>
```

The rest of Phase 17 (filtering, header `+`, rename of textos) remains valid.
The route slug `nuevo-subgrupo` would temporarily stay as legacy
(textos already say "Grupo" — transient inconsistency tolerated).
