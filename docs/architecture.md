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
plantation_users
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
Sube Parcelas pendientes, luego Grupo + Árboles (RPC sync_subgroup)
↓
Servidor valida datos (código de grupo único por parcela)
↓
Grupo marcado como sincronizado localmente (pendingSync = false)
```

El ciclo completo además sincroniza: catálogo de especies, plantaciones creadas
offline, ediciones de plantación, parcelas (push/pull) y fotos (Storage).

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

Los IDs finales se generan al finalizar la plantación, **desde la app** (admin):
`generateIds()` asigna en SQLite local, en una transacción atómica, el ID parcial
(1..N por plantación) y el ID global (secuencial org-wide desde una semilla que el
admin define; el sistema sugiere max + 1).

Tipos de ID:

```
ID parcial de plantación  (plantacion_id)
ID global Bayka           (global_id)
```

**Persistencia en el server en el mismo paso.** "Generar IDs" **requiere conexión**
(se gatea en la UI). Tras asignar los IDs en local, se suben a Supabase de inmediato
con un RPC dedicado y liviano (`update_tree_ids`, mig. 020): un bulk UPDATE de
`plantacion_id`/`global_id` por id, sin re-subir grupos/árboles completos. Generar
IDs **no** marca `pendingSync`. Si el push falla, la UI le ofrece al usuario
**reintentar** o **diferir**; al diferir, recién ahí se marcan los grupos
`pendingSync` para que la próxima sincronización los persista vía `sync_subgroup`.

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