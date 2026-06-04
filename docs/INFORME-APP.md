# Informe: Bayka App - Sistema de Monitoreo de Plantaciones

## Resumen

Bayka es una **aplicacion movil offline-first para el monitoreo de plantaciones de restauracion ecologica**. Permite que tecnicos de campo registren arboles plantados sin necesidad de conexion a internet, sincronizando los datos con un servidor central cuando hay conectividad disponible. El MVP soporta la temporada de plantacion "Otono 2026" para la organizacion Bayka.

---

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | React Native 19, Expo 54, TypeScript |
| Navegacion | Expo Router (file-based routing) |
| Base de datos local | SQLite con Drizzle ORM |
| Backend | Supabase (Auth + PostgreSQL) |
| Almacenamiento seguro | expo-secure-store |
| Testing | Jest (unit/integration), Maestro (E2E) |

---

## Roles de Usuario

### 1. Administrador

El administrador gestiona las plantaciones y supervisa el trabajo de los tecnicos:

- Crear, editar y eliminar plantaciones
- Configurar las especies disponibles por plantacion
- Asignar tecnicos a plantaciones
- Finalizar plantaciones (cuando se cumplen las condiciones)
- Generar IDs secuenciales de arboles (por plantacion y globales)
- Exportar datos a XLSX
- Ver el estado de sincronizacion de todos los tecnicos
- Resolver conflictos de arboles N/N (no identificados) con datos del servidor

### 2. Tecnico de Campo

El tecnico realiza el trabajo de registro en terreno:

- Registrar parcelas y grupos (lineas/agrupaciones) dentro de una plantacion
- Registrar arboles individuales con su especie
- Capturar fotos de arboles
- Resolver arboles N/N localmente
- Activar sincronizacion manual
- Ver las plantaciones asignadas

---

## Entidades de Datos

| Entidad | Proposito | Campos Clave |
|---------|-----------|-------------|
| **Especies** | Catalogo global de tipos de arbol | codigo, nombre, nombreCientifico |
| **Plantaciones** | Evento de restauracion (conjunto de parcelas) | lugar, periodo, estado (activa/finalizada), pendingSync |
| **Parcelas** | Nivel intermedio dentro de una plantacion | nombre, codigo (unico por plantacion) |
| **Grupos** | Lineas o agrupaciones de arboles dentro de una parcela | nombre, codigo (unico por parcela), tipo (linea/parcela), estado (activa/finalizada/sincronizada) |
| **Arboles** | Registro individual de arbol | especieId, posicion, subId, fotoUrl, globalId, usuarioRegistro |
| **EspeciesPlantacion** | Especies habilitadas por plantacion | plantacionId, especieId, ordenVisual |
| **OrdenEspeciesUsuario** | Preferencia de orden de especies por usuario | userId, plantacionId, especieId, ordenVisual |
| **UsuariosPlantacion** | Asignacion de tecnicos | plantationId, userId, rolEnPlantacion |

### Jerarquia de datos

`Plantacion → Parcela → Grupo → Arbol`

Una plantacion es un conjunto de parcelas. La parcela es el nivel intermedio y agrupa grupos; el grupo agrupa arboles. (En v1.1 el antiguo nivel "Subgrupo" hijo directo de la plantacion se renombro a "Grupo" y paso a colgar de la parcela.)

Reglas de unicidad:

- **Codigo de parcela:** unico por plantacion.
- **Codigo de grupo:** unico por parcela (puede repetirse entre parcelas de la misma plantacion; NO es unico por plantacion).
- **Unico en la plantacion:** la combinacion `codigo parcela + codigo grupo`.

---

## Funcionalidades Principales

### 1. Arquitectura Offline-First

- Todas las lecturas de datos se hacen desde SQLite local
- El estado de red se monitorea via NetInfo
- El refresco automatico se suspende cuando no hay conexion
- Los tokens de sesion se cachean en secure-store para permitir login offline

### 2. Sistema de Autenticacion

- **Login online:** Supabase SDK con email/password
- **Login offline:** Verificacion de hash SHA256 contra credenciales cacheadas
- **Expiracion configurable:** TTL para sesiones offline
- **Persistencia de sesion:** Se restaura desde cache al iniciar la app
- **Network-aware:** Solo refresca tokens cuando hay conexion

### 3. Sincronizacion Bidireccional

Los grupos son la unidad de sincronizacion (no arboles individuales):

- **Pull:** Descarga parcelas, grupos, arboles y configuraciones de especies desde el servidor
- **Push:** Sube parcelas, grupos y arboles nuevos/modificados
- **Fotos:** Sincronizacion de fotos separada de los datos
- **Progreso en tiempo real:** Modal con barra de progreso durante la sincronizacion
- **Deteccion de conflictos:** Discrepancias en fotos del servidor activan el flujo de resolucion N/N

### 4. Registro de Arboles

- Grilla de botones de especies (configurable por plantacion)
- Captura o seleccion de fotos
- Tracking automatico de posicion (auto-incremento por grupo)
- Lista local de arboles con edicion y eliminacion
- Generacion automatica de SubID: `codigo_parcela + codigo_grupo + codigo_especie + posicion`

### 5. Resolucion de Arboles N/N (No Identificados)

- Interfaz swipeable para arboles sin especie asignada
- Gestos de zoom/pan en fotos
- Seleccion de especie desde la grilla
- Comparacion de seleccion local vs. servidor en conflictos de sincronizacion
- Opcion de aceptar la sugerencia del servidor o mantener la seleccion local

### 6. Generacion de IDs (IDGN)

- **SubID:** Automatico al registrar (codigoParcela + codigoGrupo + codigoEspecie + posicion)
- **ID Plantacion:** Secuencial dentro de la plantacion (se asigna al finalizar)
- **ID Global:** Secuencial en toda la organizacion (admin configura la semilla = max + 1)
- Requiere que todos los N/N esten resueltos antes de finalizar

### 7. Gate de Finalizacion

Antes de finalizar una plantacion, se verifican las siguientes condiciones:

- Existe al menos un grupo
- Todos los grupos tienen estado "finalizada" o "sincronizada"
- No hay grupos con sincronizacion pendiente
- Todos los arboles N/N estan resueltos (unresolvedNNCount = 0)

### 8. Gestion de Especies

- Catalogo global que se siembra al iniciar la app
- Seleccion de especies por plantacion
- Orden personalizable de botones de especies por usuario
- Datos de conflicto en arboles N/N (sugerencia del servidor)

### 9. Exportacion de Datos

- Exportacion de datos de plantacion a formato XLSX

---

## Estructura de Navegacion

```
App
├── Login (email + password, online/offline)
│
├── Admin
│   ├── Plantaciones (dashboard con filtros por estado)
│   ├── Perfil (datos de usuario, logout)
│   └── Detalle Plantacion (lista de parcelas)
│       ├── Catalogo de Especies
│       ├── Nueva Parcela
│       └── Detalle Parcela (lista de grupos)
│           ├── Nuevo Grupo
│           └── Detalle Grupo (registro de arboles)
│               └── Resolucion N/N
│
└── Tecnico
    ├── Plantaciones (dashboard de plantaciones asignadas)
    ├── Perfil (datos de usuario, logout)
    └── Detalle Plantacion (lista de parcelas)
        ├── Catalogo de Especies
        ├── Nueva Parcela
        └── Detalle Parcela (lista de grupos)
            ├── Nuevo Grupo
            └── Detalle Grupo (registro de arboles)
                └── Resolucion N/N
```

---

## Arquitectura del Codigo

### Separacion de Responsabilidades

| Capa | Ubicacion | Responsabilidad |
|------|-----------|----------------|
| Pantallas | `src/screens/` | Composicion de componentes y layout |
| Componentes | `src/components/` | 42+ componentes reutilizables de UI |
| Hooks | `src/hooks/` | 26+ hooks custom (puente entre datos y UI) |
| Repositorios | `src/repositories/` | Mutaciones y queries de entidad (Drizzle ORM) |
| Queries | `src/queries/` | Queries de lectura, estadisticas, agregaciones |
| Servicios | `src/services/` | Logica de negocio (sync, auth offline, fotos, export) |
| Tema | `src/theme.ts` | Colores, tipografia, espaciado centralizado |

### Principios de Diseno

- **Cero duplicacion entre roles:** Pantallas compartidas parametrizadas por rol. Las carpetas `(admin)` y `(tecnico)` solo contienen wrappers de navegacion.
- **Cero queries en pantallas:** Los componentes nunca acceden directamente a la base de datos; toda query pasa por repositorios/queries.
- **Un solo lugar de cambio:** Colores, estilos y comportamientos compartidos se definen una sola vez en el tema.
- **Funciones atomicas:** Maximo 20 lineas por funcion, logica extraida y reutilizable.

---

## Resumen de Componentes Clave

### Componentes de UI

- `PlantationCard` - Tarjeta de plantacion con estadisticas e indicador de sync
- `SpeciesButtonGrid` - Grilla interactiva de botones de especies
- `PhotoViewer` - Visualizador de fotos con zoom
- `TreeRowItem` - Fila de arbol en lista con edicion/eliminacion
- `GrupoForm` - Formulario de creacion/edicion de grupos
- `SyncProgressModal` - Progreso de sincronizacion en tiempo real
- `StatusChip` / `PlantationEstadoChip` - Badges de estado
- `ScreenContainer` / `ScreenHeader` - Wrappers de layout

### Servicios

- **SyncService** - Orquestador de sincronizacion bidireccional con callbacks de progreso
- **OfflineAuthService** - Login offline con hash SHA256 y cache de credenciales
- **PhotoService** - Captura y almacenamiento local de fotos
- **ExportService** - Exportacion de datos a XLSX
