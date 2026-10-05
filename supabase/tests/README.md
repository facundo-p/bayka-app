# Tests de base (pgTAP)

## Flujo

Baseline + migraciones archivadas vs. pendientes: ver `docs/db-baseline.md`
(fuente de verdad de esa historia, no la repitas acá).

`run-db-tests.sh` arma, en `supabase/.tmp-dbtest/` (gitignored, recreado en
cada corrida), un proyecto temporal: baseline (copiada como
`00000000_baseline.sql`, ordena primero sin importar el prefijo real) + todo
`supabase/migrations/*.sql` + los contratos de `contracts/`
(`99999999999998_contratos.sql`, ver Contratos) + `test-helpers.sql` como
última migración (`99999999999999_test_helpers.sql`). Sin filtros ni
renombrados: la baseline ya sale curada de `regenerate-baseline.sh`.

## Cómo correr

`supabase/tests/run-db-tests.sh` — requiere Docker. Usa el `supabase` del
PATH si existe (CI, vía `supabase/setup-cli@v1`, mismo pin que
`supabase/tests/lib.sh`) o `npx supabase@<versión pinneada>` si no. Puertos y
proyecto propios (55321+) para no pisar un stack de desarrollo (54321+). Para
dejar el stack levantado: `DB_TEST_KEEP_RUNNING=1
supabase/tests/run-db-tests.sh`, luego `npx supabase@<versión> stop
--workdir supabase/.tmp-dbtest --no-backup`. `.github/workflows/db-tests.yml`
corre lo mismo en cada PR/push a `supabase/**` o `contracts/**`.

`run-db-tests.sh` y `regenerate-baseline.sh` usan `supabase db start`
(levanta solo el contenedor de Postgres) en vez de `supabase start` (~13
contenedores): `test db`/pgTAP y `db dump` corren contra la conexión directa
a Postgres, no necesitan kong/gotrue/storage-api/etc. Verificado: el schema
`storage` (tablas, y el bucket + policies de `storage.objects` que agrega
`baseline-extras.sql`) ya vienen en la imagen de Postgres de Supabase, sin
depender del contenedor `storage-api`. `db start` sobre un volumen nuevo
aplica baseline + migraciones directo (no hace falta `db reset` después);
`run-db-tests.sh` solo resetea si detecta un volumen reusado de una corrida
anterior con `DB_TEST_KEEP_RUNNING=1`.

## Regenerar la baseline

Regenerar ya no es rutina y no se archiva: ver `docs/db-baseline.md`. Mecánica del
script (`regenerate-baseline.sh`): stack con baseline + migraciones
pendientes → `db dump --schema public` → agrega `baseline-extras.sql`.

`baseline-extras.sql` trae lo que un dump de un solo schema no incluye:
bucket `tree-photos` + policies de `storage.objects` (008), y los triggers
`trg_handle_new_user`/`trg_sync_profile_email` sobre `auth.users` (026; sus
funciones sí están en el dump, viven en `public`).

## Autenticación simulada

`auth.uid()` lee `request.jwt.claim.sub`. Cada test simula un usuario dentro
de la transacción de la que hace rollback:
`set local role authenticated; select set_config('request.jwt.claim.sub',
'<uuid>', true);` — `reset role;` vuelve a superusuario entre fixtures.

## Auxiliares de test

`test-helpers.sql` define funciones en el schema `tests`, solo en el proyecto
temporal: no está en `supabase/migrations/`, así que nunca llega a staging ni a
prod. No se pueden definir dentro de un `*.test.sql`, porque cada archivo hace
rollback de lo suyo.

`tests.crear_plantacion(p_id, p_organizacion_id, p_creado_por, p_lugar,
p_periodo, p_estado, p_codigo, p_archivada_en, p_objetivo_arboles)` inserta una
plantación con valores por defecto válidos y devuelve el id: `periodo` `2026`,
`estado` `activa` y `codigo` con los últimos 8 caracteres hex del id. El test
pasa por nombre solo lo que le importa (`p_estado => 'finalizada'`). Corre con los
privilegios de quien llama, como el INSERT directo. Una columna obligatoria
nueva en `plantations` se resuelve ahí, no en cada test (#711). Quedan a mano
los INSERT que son el objeto del test: los de `lives_ok`/`throws_ok` y el
backfill de `40`, que necesita filas sin `codigo`.

## Contratos

`run-db-tests.sh` carga cada `contracts/*.json` como fila de `tests.contratos`
(`99999999999998_contratos.sql`, antes de los auxiliares), y
`tests.contrato('<archivo>.json')` devuelve su JSON o falla si no está. Así un
test recorre la misma tabla de casos que los contract tests de web y mobile:
cambiar una regla de un solo lado rompe el test de los otros (#735).

## Tests

`01`-`02` membresía en INSERT (groups/parcelas), `03` guard de
`sync_subgroup`, `04` gate por rol, organización y archivado de `generate_tree_ids` (042), `05`
`update_tree_ids` removida, `06` resto de 030, `07` mismo fix en `trees`
INSERT, `09` helpers de estado/seed de `global_id` (032, #309), `10` SELECT
scoped por membresía/organización, incluida `storage.objects` de `tree-photos`
(033, #310), `11` alta de plantaciones con `INSERT … RETURNING` bajo esa
RLS (034, #379), `12` columna `photo_capture_all_trees` con su default (035,
#439), `13` `sincronizar_borrados` (036, #467), `14` plantación finalizada
inmutable (037, #469), `15` plantación archivada: matriz de roles de
`archivar_plantacion`/`desarchivar_plantacion` y solo lectura también para
superadmin (038, #477), `16` eliminar plantación: matriz de rol × con/sin
datos × archivada, nombre de confirmación, cascade completo, registro en
`plantaciones_eliminadas` y los cuatro valores de `estado_remoto_plantaciones`
(039, #478), `18` DELETE de fotos en `tree-photos` exige admin y membresía en
la plantación del path (041, #481), `19` `profiles.eliminado_en`: solo la
cambia service_role, un eliminado nunca está activo ni recibe membresías admin
(040, #479), `20` `is_admin()` exige perfil activo: un admin o superadmin
inactivo no lee por la vía admin (043, #506), `22` RPC `quitar_fotos_arboles`
(044, #498), `23` perfil inactivo: no pasa las policies de admin,
`is_superadmin()` ni `is_plantation_member()`, incluidos `sync_subgroup` y
Storage (045, #508), `24` INSERT/UPDATE/upsert de fotos en `tree-photos` exigen
plantación escribible (046, #512), `25` asignaciones de técnicos: exigen
plantación existente y no archivada, una finalizada las admite (047, #522),
`26` escrituras de admin acotadas a la organización: plantaciones, especies y
asignaciones con dos organizaciones, y perfiles vía superadmin (048, #543), `27`
reemplazo de especies y técnicos por RPC: gates de rol, organización y estado,
rechazos sin efectos y membresías admin e inactivas intactas (049, #544), `28`
perfil inactivo: pierde su organización y la edición de su propio nombre, y
sigue leyendo su propia fila, que es como se entera de la baja (050, #532),
`29` las dos capas del cambio de rol —la policy sobre un perfil ajeno, el
trigger sobre el propio— y parcelas sin DELETE físico, con el tombstone
intacto (051, #314), `30` reabrir una finalizada: solo superadmin activo de la
organización, la archivada se rechaza, los grupos conservan su estado y el
técnico vuelve a escribir (052, #470), `31` cambiar el código de una parcela
reescribe el prefijo del SubID de sus árboles (solo los que calzan con parcela +
grupo), y en una finalizada el admin no llega a cambiarlo (053, #623), `32`
`sync_subgroup` pisa código, nombre y tipo del grupo, rechaza un nombre repetido
con DUPLICATE_NAME y pasa al código vigente de la
parcela los SubID armados con el que manda el móvil en `parcela_codigo` (054, #626), `33`
una especie con árboles no se quita de su plantación, ni por DELETE ni por
`reemplazar_especies_plantacion`, y el cascade de borrar la plantación pasa (055, #632), `34`
el técnico crea parcelas (INSERT y upsert sin conflicto) pero no las edita ni
tombstonea; su upsert sobre una existente da 42501 y con `ON CONFLICT DO NOTHING`
queda sin efecto; admin y superadmin editan (056, #640). `35`
`editar_plantacion` aplica cada campo solo si el server conserva la base
(sin conflicto, mismo campo, campos distintos, mismo valor en los dos lados),
valida como la web y rechaza finalizada, archivada, inexistente y sin permiso;
el UPDATE directo ya no cambia `estado` salvo `activa → finalizada`, ni
`organizacion_id`, `creado_por` o la auditoría `ultima_edicion` (057, #634). `36`
`aplicar_cambios_especies`: gates de rol, organización y estado; altas y bajas
idempotentes, una baja con árboles rechazada sola, alta de especie inexistente,
cambios de web y teléfono en especies distintas que conviven, `orden_visual`
alfabético, y `sync_subgroup` re-habilitando la especie de un árbol que sube
(058, #635). `37` `aplicar_cambios_tecnicos`: gates de rol, organización y
estado (una finalizada admite, una archivada no), altas y bajas idempotentes,
un alta concurrente que no pisa las demás, técnico inactivo, de otra
organización o usuario que no es técnico rechazado solo con su motivo, la baja
no toca la membresía admin (059, #636). `38` un INSERT en `auth.users` deja
el profile `tecnico` y sin organización aunque la metadata pida otra cosa, y
así no lee perfiles, organizaciones ni plantaciones; rol y organización en un
mismo UPDATE (como `admin-users`) suman al admin a las plantaciones de su
organización (060, #607). `39` `fotos_quitadas`: `quitar_fotos_arboles`
registra el path quitado (también de una URL completa), sin grants para
`authenticated`, y la limpieza con service_role no devuelve un path que un árbol
volvió a usar ni un objeto reescrito después de quitarlo (061, #516). `40`
código de plantación: formato (A-Z, 0-9 y guion suelto, hasta 8), obligatorio,
único por organización, libre tras eliminar, solo cambia con la plantación
activa y no archivada —para todos los roles— y el backfill (códigos manuales,
`P<n>` para el resto, falla ante ambigüedad o una de San Sebastián que no calza)
(062, #559). `41` `editar_plantacion` con `codigo`: lo aplica y audita, rechaza
uno repetido con CODIGO_DUPLICADO sin aplicar nada, valida formato, detecta
conflictos y no lo cambia en una finalizada aunque el superadmin edite lo demás
(062, #559). `42` el UPDATE directo de los 9 campos
editables de `plantations` falla para `authenticated`, `estado` (finalizar) y
`editar_plantacion` siguen andando (063, #649). `43`
`cambiar_especie_arbol`: aplica con la base vigente y rearma el SubID, devuelve
CONFLICTO_EDICION con la especie del server si la base quedó vieja, acepta la
especie que el árbol ya tiene, rechaza una especie no habilitada (y N/N), exige
membresía, y en una finalizada solo deja al superadmin; en una archivada a nadie.
`sync_subgroup` con `species_base_id` conserva la especie del server si difiere de
la base, rearma el SubID con su código, no deshace un N/N resuelto, devuelve en
`conservadas` todo árbol que quedó con otra especie que la que mandó el móvil
(también uno sin tocar), y sin base pisa como antes
(065, #679). `44` ramas de `sync_subgroup`
sin otro test: el re-sync de un árbol pisa especie y SubID pero no la posición,
y conserva foto, ids y GPS que no vienen; una especie vacía queda N/N; sin
especies que habilitar no reordena; con código y nombre repetidos gana
DUPLICATE_CODE; una excepción, también en las validaciones, responde UNKNOWN y
deshace el grupo ya escrito. `45` las partes de `sync_subgroup` no las ejecutan
`authenticated` ni `anon`, son SECURITY INVOKER, y la orquestadora sigue
SECURITY DEFINER, con sus grants y en menos de 40 líneas (064, #734). `46`
`sync_subgroup` no escribe fuera del grupo que sube: un árbol de otra
plantación o de otro grupo (por id o por `group_id`) rechaza todo sin tocarlo,
un grupo que ya existe en otra plantación o parcela y una parcela de otra
plantación responden REFERENCIA_AJENA (antes que DUPLICATE_*), las partes de
grupo y árboles rechazan aunque las llamen solas, y el re-sync de un árbol
propio y el alta de grupo con árbol nuevo siguen andando (066, #732). `47`
`contracts/permisos-edicion.json`: los casos `web` contra
`cambiar_especie_arbol` y `editar_plantacion`, los casos `app` contra
`sync_subgroup` de un técnico asignado; un rechazo cuenta solo si es del gate, y
cada tabla trae todas las combinaciones y los dos desenlaces (#735). `48`
`contracts/sub-id.json`: el SubID que arman `cambiar_especie_arbol` y
`sync_subgroup` al conservar la especie, y la reescritura del prefijo al
cambiar el código de la parcela (#735). `49` las policies de SELECT de `trees`
y `groups` calculan `mis_plantaciones()` una vez por query y cada rol ve las
mismas filas que antes; `catalogo_conteos` cuenta solo lo visible (067, #682).
`50` `dashboard_arboles` y `arboles_por_grupo` cuentan solo lo que el usuario
puede leer, agrupan el mes en UTC, no cuentan fotos locales (`file://`,
`content://`) ni vacías, e incluyen los grupos vacíos (068, #684).
`51` `catalogo_conteos` suma fotos y bytes desde `storage.objects` (paths
relativos y URLs viejas con `?token=`), sin contar fotos locales, referencias sin
objeto ni objetos que la policy de Storage no deja leer, y sin alterar grupos ni
árboles (069, #685).

## Hallazgo fuera de alcance (no corregido)

`sync_subgroup` (028) inserta `groups.parcela_id` sin validar que venga en el
payload; un cliente que la omita dispara el NOT NULL de 030 (23502), pero
`sync_subgroup` atrapa cualquier excepción (`EXCEPTION WHEN OTHERS`) y
responde `{success: false, error: 'UNKNOWN'}` — el cliente nunca ve el
23502 crudo.
