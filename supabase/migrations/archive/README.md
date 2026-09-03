# Migraciones archivadas (001–030)

Histórico, no replayable desde una base vacía: 013–015 son migraciones de
**datos** (consolidación/borrado de plantaciones reales de un momento puntual,
#283), no de esquema. Se conservan solo como referencia/auditoría.

`030_security_hardening_and_indexes.sql` es la última carpeta acá: su
contenido ya está incluido en `supabase/baseline_schema.sql` (re-baseline,
#283), pero staging/prod que todavía no la tenían aplicada **deben correrla a
mano** antes de asumir que su schema coincide con el baseline nuevo.
