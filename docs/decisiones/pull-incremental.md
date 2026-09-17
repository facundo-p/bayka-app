# Decisión: pull incremental con watermark

Estado: **recomendado, condicionado a una medición** · Alcance: Bayka App + Supabase

Salida del spike #453. Prerrequisitos del issue (#448 transacciones reales, #449
velocidad de escritura) resueltos antes de escribir esto.

## Qué se descarga hoy

Cada pull baja el 100% de las seis fases con `select('*')` y sin ningún filtro
temporal (`pullService.ts`, `preSteps.ts`). No hay watermark en ningún lado: ni
tabla de metadata de sync en SQLite, ni columna en el server, ni nada en
SecureStore.

Peso real por fila, serializada como la manda PostgREST:

| Tabla | Columnas | Bytes/fila | 12.000 árboles / 1.000 grupos |
|---|---|---|---|
| `trees` (con foto y GPS) | 15 | ~690 B | **~8 MB** |
| `trees` (sin foto ni GPS) | 15 | ~480 B | ~5,5 MB |
| `groups` | 9 | ~330 B | ~330 KB |
| el resto | — | — | despreciable |

Con la compresión de PostgREST eso es **~2 MB por sincronización** de una
plantación grande. En una conexión de campo de 50 kB/s son ~40 segundos, cada vez,
aunque no haya cambiado una fila.

Un técnico que registra 200 árboles en un día y sincroniza cinco veces baja hoy
~10 MB comprimidos para traerse 140 KB de novedad.

### Dos gramos de grasa, aparte del watermark

`trees.subgroup_id` es `GENERATED ALWAYS AS (group_id) STORED`
(`supabase/baseline_schema.sql:491`): un duplicado exacto de `group_id` que
PostgREST devuelve porque el pull pide `*`, y que el cliente ya ignora
(`t.group_id ?? t.subgroup_id`). Son 52 B por árbol, **~8% del peso de la fase**.

No es gratis sacarlo: el `select('*')` es deliberado —tolera un server sin las
columnas nuevas, que pedidas por nombre romperían el pull entero— y PostgREST no
tiene sintaxis para excluir una columna. Se resuelve cuando se retire el shim de
compatibilidad, no antes.

`foto_url` es otro 21% del peso de una fila con foto: el path repite tres UUID
(`plantations/{uuid}/parcelas/{uuid}/trees/{uuid}.jpg`) de los cuales dos ya
vienen en la misma fila.

## El bloqueo que el issue asumía no existe

El issue frena el trabajo sobre esta premisa:

> Filtrar por `updated_at > último_sync` cambia la semántica: **las filas borradas
> en el servidor dejarían de propagarse al dispositivo**.

Es cierto en general y es el riesgo correcto a temerle. Pero para las dos tablas
que pesan, **no aplica: nadie borra `groups` ni `trees` en el servidor.**

- No existe ni un `DELETE FROM trees`/`groups` en SQL, ni un
  `.from('trees'|'groups').delete()` en mobile ni en la web.
- El RPC `sync_subgroup` (`supabase/baseline_schema.sql:258-333`) es
  `INSERT … ON CONFLICT DO UPDATE`. No borra nada.
- La única forma de que desaparezcan es la cascada al borrar la plantación
  entera, que desde #478 sí ocurre (`eliminar_plantacion`, `trees_group_id_fkey
  … ON DELETE CASCADE`). Ese caso está cubierto fuera de banda, antes de bajar
  filas: `tieneAccesoRemoto` consulta `estado_remoto_plantaciones`, que devuelve
  `eliminada` si el id figura en `plantaciones_eliminadas` de la organización del
  usuario. El pull corta con `PULL_ESTADO.eliminada` y no toca los datos locales;
  la plantación queda en solo lectura hasta que el usuario la borre del
  dispositivo. Contra un server sin ese RPC vuelve al chequeo de membresía y la
  ve como `PULL_SIN_ACCESO` (#317). Un watermark por `updated_at` no cambia
  nada de esto: la plantación borrada desaparece entera, no fila por fila.
- `deleteTreeAndRecalculate` (`mobile/src/repositories/TreeRepository.ts`) sí borra
  árboles, pero **en SQLite local**, y eso nunca se propaga como delete al server.

Conclusión: para `trees` y `groups` **no hacen falta tombstones**. Si alguna vez
se agrega un borrado real de árbol —hoy no se puede— el tombstone pasa a ser
precondición de este diseño, y hay que volver acá antes de agregarlo.

### Bug encontrado de paso: el pull resucita árboles borrados

`deleteTreeAndRecalculate` borra el árbol en SQLite y renumera los que quedan,
pero **no borra nada en el server**, y el push (`sync_subgroup`) solo upsertea.
Si el grupo ya se había sincronizado, la fila sigue viva allá y **el próximo pull
la vuelve a insertar**, ahora con una `posicion`/`sub_id` que chocan con la
renumeración.

No lo causa este spike ni lo empeora: pasa hoy, con el pull full. Va anotado acá
porque desarma el otro medio argumento del issue —"lo que no vino se considera
ausente"— que para `trees` tampoco es cierto: el pull no es un propagador de
borrados, es lo contrario. Merece su propio issue.

## El bloqueo que sí existe: no hay `updated_at`

| Tabla | `created_at` | `updated_at` | `deleted_at` |
|---|---|---|---|
| `parcelas` | sí | **sí** | **sí** |
| `trees` | sí | no | no |
| `groups` | sí | no | no |
| `plantations` | sí | no | no |
| `species` | sí | no | no |
| `plantation_users` | no (`assigned_at`) | no | no |
| `plantation_species` | **ninguna columna de tiempo** | — | — |

Y **no hay un solo trigger que mantenga `updated_at`**. Los cinco triggers del
proyecto son `trg_add_admin_memberships`, `trg_protect_profile_fields`,
`trg_sync_admin_memberships` (`supabase/baseline_schema.sql:594-602`) y dos sobre
`auth.users` (`:1057,1061`). `moddatetime` no se instala en ningún lado.

**Un watermark sobre `created_at` sería incorrecto**, no solo incompleto: hay tres
caminos que mutan árboles existentes sin tocar ninguna columna de tiempo.

1. `sync_subgroup` actualiza `species_id`, `sub_id`, `foto_url`, `global_id` y los
   cuatro campos de GPS (`supabase/baseline_schema.sql:318-327`).
2. La subida de foto hace `UPDATE trees SET foto_url`
   (`mobile/src/services/sync/photoService.ts:30-33`).
3. `generate_tree_ids` actualiza `global_id`/`plantacion_id`
   (`supabase/migrations/032_ids_helpers.sql:78`).

Un device filtrando por `created_at` no vería ninguna de las tres. La resolución
de especie de otro técnico, por ejemplo, no llegaría nunca.

`parcelas.updated_at` existe pero **tampoco sirve como watermark**: lo escribe el
cliente desde `localNow()` (`pushService.ts:43` ← `ParcelaRepository.ts:121,151,175`),
así que depende del reloj del dispositivo que pusheó. Son pocas filas: la fase
sigue full y no hay nada que arreglar.

## Diseño propuesto

### Qué se vuelve incremental y qué no

| Fase | Modo | Por qué |
|---|---|---|
| `trees` | **incremental** | Es el 95% del peso |
| `groups` | **incremental** | Segunda en peso, mismo cambio |
| `parcelas` | full | Pocas filas; su `updated_at` es del reloj del device |
| `plantation_users` | full — **no se puede** | El replace destructivo detecta revocados por diferencia de conjuntos (`pullService.ts:293-320`): necesita la lista completa |
| `plantation_species` | full — **no se puede** | Cero columnas de tiempo, y `saveSpeciesConfig` es delete-all + re-insert |
| `species` | full | Catálogo global chico |

Las dos que no se pueden son justamente las chicas. No se pierde nada.

### El watermark sale del server, nunca del device

**`max(updated_at)` de las filas recibidas**, no `Date.now()`.

Eso elimina el problema de reloj de raíz —el valor siempre lo generó `now()` del
server, vía el trigger— y además esquiva la carrera clásica: una fila commiteada
mientras el pull está en vuelo queda por encima del máximo recibido y entra en la
próxima corrida. Un watermark tomado de `now()` al arrancar la sí se saltearía.

Vive en una tabla local nueva de metadata de sync, **por plantación y por tabla**.
`NULL` significa full, y es el estado inicial: un device nuevo, o un usuario recién
agregado a una plantación de 2024, arranca en cero y baja todo. No hace falta
ningún caso especial.

### Red de seguridad

Pull full **a pedido** (un botón "resincronizar todo" que pone los watermarks en
`NULL`) y automático cada N días. Es barato y elimina la clase entera de
"divergencia silenciosa": cualquier desfasaje que se cuele tiene fecha de
vencimiento en vez de ser permanente.

### El chequeo de conflicto de especie ya es compatible

El issue lo marcaba como riesgo: `checkTreeConflict` asumía ver todas las filas.
Después de #449 no: lee los árboles **locales** de esos grupos de una vez y cruza
contra las filas remotas recibidas. Un árbol remoto que no llega simplemente no se
evalúa — que es lo correcto, porque no cambió. No hay nada que adaptar.

### Un device que estuvo meses sin sincronizar

Sigue siendo más barato o igual: trae exactamente las filas que cambiaron. El
único escenario donde el incremental pierde contra un full es que haya cambiado
casi todo el dataset, y ahí lo que se paga de más es el índice, que es marginal.
No hace falta un umbral de "si son muchas, mejor full".

## Etapas

**Paso 0 — medir. Gratis, y va primero.**
Con los logs que dejaron #448 y #449 (`Pull fase arboles: Nms`, `Upload/Download
fotos: … en Xms`), un pull de una plantación grande en el APK TEST dice si el
tiempo se va en la red o en la escritura local. **Si se va en escritura, este spike
se cierra acá**: el ahorro de red no se va a notar.

**Paso 1 — que el dato exista.** Migración que agrega a `trees` y `groups`:

```sql
ALTER TABLE trees ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER trees_set_updated_at BEFORE UPDATE ON trees
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
CREATE INDEX trees_group_updated_idx ON trees (group_id, updated_at);
```

Sin tocar el pull. Bajo riesgo, y a partir de ahí el dato se acumula solo. El
índice compuesto es necesario: hoy el server no tiene ningún índice sobre una
columna de tiempo.

**Paso 2 — usarlo.** Watermark local + `.gt('updated_at', w)` en las dos fases,
más el full a pedido. Recién acá cambia la semántica del sync, y ya con el dato
poblado hace rato.

## Recomendación

**Hacerlo, en esas tres etapas, si y solo si el paso 0 muestra que la red pesa.**

El spike cambia el veredicto que el issue anticipaba. El motivo por el que esto
figuraba como "el trabajo de mayor riesgo de todos" era la propagación de
borrados, y para las dos tablas que importan **ese riesgo no existe**: nadie las
borra de a una (el borrado de una plantación entera se detecta aparte, ver arriba). Lo que queda es una migración aditiva con trigger y un watermark que sale
del server — trabajo acotado, no un cambio de semántica de la sincronización.

Lo que sí hay que respetar es el orden. Medir primero no es burocracia: si el
cuello de botella real es la escritura local, el ahorro de red rinde mucho menos
de lo que la tabla de arriba sugiere, y esto no se justifica.
