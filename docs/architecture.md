# architecture.md
## Arquitectura Técnica – Aplicación de Monitoreo de Plantaciones Bayka

Este documento describe la arquitectura técnica del sistema.

Define:

- stack tecnológico
- componentes principales
- arquitectura offline-first
- estrategia de sincronización
- almacenamiento local
- estructura del código

Este documento complementa:

```
SPECS.md
domain-model.md
```

---

# 1. Principios de Arquitectura

El sistema se diseña bajo los siguientes principios:

### Offline-first

Toda la carga de datos ocurre localmente en el dispositivo.

La aplicación debe funcionar completamente sin conexión.

---

### Sincronización manual

Los usuarios deciden cuándo sincronizar.

La sincronización ocurre cuando hay conectividad.

---

### Unidad de sincronización: Grupo

Los Grupos se sincronizan completos (Grupo + sus árboles). Antes de los grupos se
sincronizan las Parcelas (orden de FK).

Esto evita inconsistencias parciales.

---

### Fotos en Supabase Storage

Las fotos se capturan localmente y se **suben a Supabase Storage** durante la
sincronización (bucket `tree-photos`). Se descargan a otros dispositivos vía URLs
firmadas. El flag `fotoSynced` controla qué falta subir. Ver §7.

---

### Datos sincronizados bloqueados

Una vez sincronizado un Grupo queda **bloqueado para edición**. Un admin o el
creador puede reactivarlo explícitamente para corregirlo.

Esto preserva la consistencia del dataset por defecto.

---

# 2. Stack Tecnológico

La aplicación utiliza el siguiente stack:

## Frontend

```
React Native
TypeScript
Expo
```

---

## Base de datos local

```
SQLite
```

Se utiliza para almacenar:

- plantaciones
- parcelas
- grupos
- árboles
- especies
- configuraciones

---

## Backend

```
Supabase
```

Se utiliza para:

- autenticación de usuarios
- almacenamiento central de datos
- sincronización de registros

---

## Autenticación

```
Supabase Auth (online)
Auth offline (OfflineAuthService + SecureStore)
```

Método:

```
email + contraseña
```

Para el uso en campo sin conexión, las credenciales se cachean en SecureStore
(`OfflineAuthService`): hash + salt para verificar login offline, con un gate de
expiración opcional. El login ofrece las cuentas guardadas como chips
("Acceso rápido").

Cada credencial offline guarda el userId de su cuenta, y el login offline deja
cacheados el userId y el rol de quien entra. En un celular compartido, si la
cuenta que entra offline no es la dueña de los tokens cacheados, esos tokens se
descartan: trabaja con una sesión solo local y el sync le pide login online
antes de subir nada, así nunca se sube con la identidad de otro (#658). Las
credenciales guardadas antes de este cambio no tienen userId y no sirven para
entrar offline hasta el próximo login online.

Toda operación contra el servidor (sync, pull-to-refresh, descarga de
plantaciones, catálogo, técnicos) pasa antes por `ensureServerSession`: sin una
sesión del SDK de la cuenta cacheada corta con `SessionExpiredError` antes de
leer, porque una lectura anónima vuelve vacía por RLS y el pull borraría datos
locales. Las escrituras que el usuario dispara fuera del sync también pasan por
el guard: editar la plantación, guardar especies y asignar técnicos quedan
pendientes para el sync, y finalizar, reabrir y quitar técnicos piden iniciar
sesión con conexión. El perfil cacheado (`PerfilCacheadoService`) guarda el
userId de su dueño y se descarta si no coincide con la cuenta activa. Un perfil
anterior a #658, sin dueño, se adopta solo si hay tokens cacheados y su email es
el del último login online.

---

# 3. Arquitectura General

Arquitectura simplificada:

```
Mobile App
   |
   | (offline operations)
   |
SQLite Local Database
   |
   | (sync)
   |
Supabase Backend
```

---

# 4. Componentes del Sistema

## 4.1 Aplicación móvil

Responsabilidades:

```
interfaz de usuario
registro de datos en campo
almacenamiento local
gestión de fotos
sincronización manual
```

La app debe poder operar completamente offline.

---

## 4.2 Base de datos local (SQLite)

La base local contiene:

```
species
plantations
plantation_species
cambios_especies_pendientes
plantation_users
altas_de_tecnicos_pendientes
tecnicos_de_organizacion   (caché para asignar sin conexión)
parcelas
groups          (groups.parcela_id → parcelas)
trees
```

Modelo jerárquico (v1.1 / Fase 16):

```
Plantación → Parcela → Grupo → Árbol
```

La tabla `subgroups` se renombró a `groups` y se agregó la tabla
`parcelas`. Cada `group` referencia su parcela vía `groups.parcela_id`.

Reglas de unicidad:

```
código de parcela único por plantación  → (plantation_id, codigo)
código de grupo   único por parcela      → (parcela_id, codigo)
```

Como cada parcela pertenece a una plantación, la combinación
(parcela + grupo) resulta única dentro de cada plantación.

También se almacenan:

```
estados de sincronización
rutas de fotos locales
```

---

## 4.3 Backend Supabase

El backend almacena:

```
organizaciones
usuarios (auth.users + profiles)
plantaciones
parcelas
grupos sincronizados
árboles sincronizados
fotos de árboles (Supabase Storage, bucket tree-photos)
```

Schema, migraciones y cómo crear un ambiente desde cero: [docs/db-baseline.md](./db-baseline.md).

---

# 5. Flujo de Datos

## Registro de datos en campo

Flujo:

```
Usuario presiona botón de especie
↓
Se crea registro de árbol
↓
Se guarda en SQLite
↓
Se actualiza interfaz
```

---

## Finalización de Grupo

Flujo:

```
Técnico presiona "Finalizar Grupo"
↓
Estado cambia a finalizada
↓
Grupo queda listo para sincronizar (pendingSync = true)
```

---

## Sincronización

Flujo:

```
Usuario inicia sincronización
↓
Sistema detecta grupos pendientes (pendingSync = true)
↓
Propaga los borrados anotados (RPC sincronizar_borrados)
↓
Sube Parcelas pendientes, luego Grupo + Árboles (RPC sync_subgroup)
↓
Servidor valida membresía, que la plantación sea escribible y el código de grupo único por parcela
↓
Grupo marcado como sincronizado localmente (pendingSync = false)
```

**Plantación finalizada o archivada** (#469, #477): el server rechaza el push con
`PLANTACION_FINALIZADA` o `PLANTACION_ARCHIVADA`. Lo pendiente no se pierde:
queda en el celular y se sube cuando la plantación vuelve a ser escribible.
Detalle por paso en `mobile/docs/sync-photo-flow.md`. Si nada lo destraba (finalizada,
archivada, eliminada o sin permiso), la tarjeta de la plantación avisa cuántos cambios
no pudieron subir y por qué, y ofrece descartarlos (#638).

El ciclo completo además sincroniza: catálogo de especies, plantaciones creadas
offline, ediciones de plantación, parcelas (push/pull) y fotos (Storage).

**Los borrados viajan aparte** (#467). Borrar un árbol o un grupo solo borra en
SQLite; el pull upsertea todo lo que el server tiene, así que sin propagarlos la
fila volvía en la misma sincronización. Se anotan en `borrados_pendientes`, el pull
los excluye y el push los manda por `sincronizar_borrados`, que es un RPC
`SECURITY DEFINER` porque **no hay policy de DELETE sobre `trees` ni `groups`**: un
delete desde el cliente sería un no-op silencioso.

El registro es explícito —una fila por id— y no una semántica de reemplazo: el
device puede tener un set parcial y "borrá todo lo que no te mandé" borraría del
server datos que nunca vio.

**Las especies de una plantación viajan como altas y bajas** (#635). Configurarlas
aplica el cambio en SQLite y lo anota en `cambios_especies_pendientes` (una fila
por especie, el último cambio gana), con o sin señal; con señal sube en el momento.
El sync sube lo pendiente antes del pull por `aplicar_cambios_especies`, que es
idempotente, y el pull no borra un alta pendiente ni devuelve una baja pendiente.
Mandar la lista entera pisaría lo que la web cambió en el medio. Una baja de una
especie con árboles la rechaza el server sola: el teléfono vuelve a habilitarla y
el resumen del sync avisa. Si igual llegan árboles de una especie quitada,
`sync_subgroup` la re-habilita. Una plantación creada offline anota solo las
bajas: su alta sube todas sus especies como altas, junto con esas bajas. El orden
de la botonera es alfabético por nombre (el orden personal de cada técnico se
mantiene).

**Asignar técnicos también viaja como altas** (#636). La pantalla lee los técnicos
activos de la organización de `tecnicos_de_organizacion`, un caché que refresca el
sync de un admin (y la pantalla, en segundo plano, si hay señal). Asignar aplica la
fila en `plantation_users` y la anota en `altas_de_tecnicos_pendientes`, con el nombre
del técnico para seguir mostrándola si sale del caché; con señal sube en el momento,
sin que la pantalla espere más de unos segundos. El sync sube lo pendiente después de
las especies y antes del pull, por `aplicar_cambios_tecnicos` (idempotente); una
plantación creada offline espera a su alta. Un técnico dado de baja, un usuario que
no es técnico o uno de otra organización lo rechaza el server solo: se quita del
teléfono y el resumen del sync avisa. El pull de `plantation_users` no
borra un alta pendiente. Quitar a un técnico ya asignado en el server requiere
conexión, y va con las altas pendientes en el mismo RPC.

---

# 6. Estrategia de Sincronización

La sincronización sigue estos principios.

## Unidad de sincronización

```
Grupo completo
```

Se sincronizan:

```
Grupo
Árboles asociados
```

---

## Condiciones para sincronizar

Un Grupo es elegible para sincronizar cuando:

```
pendingSync = true
```

---

## Conflictos

Si el servidor detecta dos grupos con:

```
mismo codigo de grupo
misma parcela        → scope (parcela_id, codigo)
```

entonces:

```
sync rechazado
```

El usuario deberá resolver manualmente.

---

# 7. Manejo de Fotos

Las fotos se capturan localmente y se sincronizan con Supabase Storage.

Local (en el dispositivo):

```
Paths.document/photos/photo_<treeId>.jpg
```

Remoto (Supabase Storage, bucket `tree-photos`):

```
plantations/<plantacionId>/parcelas/<parcelaId>/trees/<treeId>.jpg
```

(Fotos previas a Parcela usan la ruta legacy
`plantations/<plantacionId>/trees/<treeId>.jpg`.)

El flag `fotoSynced` en `trees` indica si la foto ya está en Storage.

---

## Política

Las fotos son opcionales para árboles normales y **obligatorias para N/N**. Para
controlar volumen y red, solo se suben las pendientes y la subida se integra al
flujo de sync manual (el técnico decide cuándo).

---

# 8. Estructura del Proyecto

Estructura recomendada:

```
bayka-app/

docs/
    SPECS.md
    domain-model.md
    architecture.md

mobile/
    src/

        app/                     (expo-router: rutas (admin)/(tecnico)/(auth))

        screens/
            PlantacionesScreen
            ParcelasScreen
            PlantationDetailScreen   (lista de grupos de la parcela)
            NuevoGrupoScreen
            TreeRegistrationScreen
            NNResolutionScreen
            CatalogScreen / PerfilScreen / ...

        components/
            SpeciesButton / SpeciesButtonGrid
            TreeRowItem
            PlantationCard / ParcelaRow / GroupStateChip / StatusChip
            (modales de sync, descarga, etc.)

        services/
            sync/  (pushService, pullService, orchestrators, downloadService)
            ExportService
            photoService
            OfflineAuthService

        repositories/
            PlantationRepository
            ParcelaRepository
            GroupRepository
            TreeRepository

        queries/                 (lecturas/agregaciones: admin, catalog,
                                  dashboard, export, parcela, freshness)

        database/
            schema  (Drizzle)
            migrations

        hooks/
            useAuth / useSync / usePlantationDetail / useTreeRegistration / ...

        utils/
            idGenerator
            ...
```

---

# 9. Capas de Arquitectura

La aplicación se organiza en capas.

```
UI (screens)
↓
Hooks
↓
Repositories
↓
SQLite
```

---

## UI

Responsable de:

```
renderizar pantallas
recibir interacción del usuario
```

---

## Hooks

Responsables de:

```
lógica de estado
coordinación de acciones
```

---

## Repositories

Responsables de:

```
acceso a datos
queries
persistencia
```

---

## SQLite

Responsable de:

```
persistencia local
operación offline
```

---

# 10. Generación de IDs

Los IDs finales se generan **desde la web de gestión, server-side** (issue #232),
no desde la app. El RPC `generate_tree_ids` (mig. 029) corre en una transacción
Postgres: ordena los árboles de la plantación (por `groups.created_at`,
`trees.posicion`, `groups.id` como desempate) y asigna el ID parcial (1..N por
plantación) y el ID global (secuencial org-wide, desde una semilla que sugiere
`MAX(global_id) + 1` o la que indique el admin).

Solo lo corre un admin o superadmin activo de la organización de la plantación
(mig. 042). Una plantación archivada devuelve `PLANTACION_ARCHIVADA`; una
finalizada sí genera IDs, porque es el momento normal de hacerlo.

Tipos de ID:

```
ID parcial de plantación  (plantacion_id)
ID global Bayka           (global_id)
```

**La app los recibe por el pull normal**, no los genera ni los sube: el upsert de
`trees` adopta `plantacion_id`/`global_id` del server si el valor local está vacío.
El RPC viejo `update_tree_ids` (mig. 020), que la app usaba para subir IDs
generados localmente, quedó sin callers y se eliminó en la mig. 030.

El gate de export exige que TODOS los árboles tengan ID.

---

# 11. Seguridad

Seguridad basada en:

```
Supabase Auth
roles de usuario
```

Reglas principales:

```
solo admins crean plantaciones
solo admins exportan datos
tecnicos solo registran datos
```

---

# 12. Escalabilidad futura

La arquitectura permite agregar:

```
multi-organización
regiones de especies
GPS por árbol
exportaciones GIS
monitoreo temporal
analytics
```

---

# Objetivo de la arquitectura

La arquitectura prioriza:

```
simplicidad
robustez en campo
facilidad de desarrollo
```

Evitar complejidad innecesaria.