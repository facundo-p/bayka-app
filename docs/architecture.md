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

### Unidad de sincronización: SubGrupo

Los SubGrupos se sincronizan completos.

Esto evita inconsistencias parciales.

---

### Fotos solo locales

Las fotos se almacenan únicamente en el dispositivo.

No se suben al servidor en la Fase 1.

Esto simplifica:

- sincronización
- consumo de red
- almacenamiento en servidor

---

### Datos sincronizados inmutables

Una vez sincronizado un SubGrupo:

```
no puede modificarse
```

Esto garantiza consistencia del dataset.

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
- subgrupos
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
Supabase Auth
```

Método:

```
email + contraseña
```

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
subgroups
trees
```

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
usuarios
plantaciones
subgrupos sincronizados
árboles sincronizados
```

No almacena fotos en esta fase.

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

## Finalización de SubGrupo

Flujo:

```
Técnico presiona "Finalizar SubGrupo"
↓
Estado cambia a finished
↓
SubGrupo queda listo para sincronizar
```

---

## Sincronización

Flujo:

```
Usuario inicia sincronización
↓
Sistema detecta SubGrupos no sincronizados
↓
Sube SubGrupo + Árboles
↓
Servidor valida datos
↓
SubGrupo marcado como synced
```

---

# 6. Estrategia de Sincronización

La sincronización sigue estos principios.

## Unidad de sincronización

```
SubGrupo completo
```

Se sincronizan:

```
SubGrupo
Árboles asociados
```

---

## Condiciones para sincronizar

Un SubGrupo puede sincronizarse si:

```
estado = finished
no existen árboles NN
```

---

## Conflictos

Si el servidor detecta:

```
mismo codigo_subgrupo
misma plantacion
```

entonces:

```
sync rechazado
```

El usuario deberá resolver manualmente.

---

# 7. Manejo de Fotos

Las fotos se almacenan únicamente en el dispositivo.

Ubicación:

```
filesystem local
```

En el registro del árbol se guarda:

```
ruta_local_foto
```

Ejemplo:

```
/photos/subgrupo_L23B/tree_12.jpg
```

---

## Motivo de almacenamiento local

Las fotos no se sincronizan porque:

```
las plantaciones pueden tener miles de árboles
las fotos aumentarían demasiado el volumen de datos
no siempre hay buena conectividad
```

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

        app/

        screens/
            LoginScreen
            DashboardScreen
            PlantationScreen
            SubGroupScreen
            TreeRegisterScreen
            NNReviewScreen
            SyncScreen

        components/
            SpeciesButton
            TreeRow
            SubGroupCard

        features/
            auth
            plantations
            subgroups
            trees
            sync

        services/
            syncService
            photoService
            exportService

        repositories/
            plantationRepository
            subgroupRepository
            treeRepository
            speciesRepository

        database/
            schema
            migrations
            seeds

        hooks/
            useAuth
            useSync
            usePlantations

        utils/
            idGenerator
            reverseOrder
            dateUtils

        types/
            domain
            api
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

Los IDs finales se generan al finalizar la plantación.

Tipos de ID:

```
ID parcial de plantación
ID global Bayka
```

Esto ocurre desde el backend o desde una herramienta administrativa.

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
subida de fotos
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