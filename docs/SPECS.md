# SPECS.md
## Aplicación de Monitoreo de Plantaciones – Bayka
### Especificación Funcional – Fase 1 (MVP)

---

# 1. Descripción General del Proyecto

Este proyecto consiste en el desarrollo de una **aplicación móvil para el monitoreo de plantaciones de restauración ecológica**, diseñada para ser utilizada en campo, en contextos donde puede no haber conectividad a internet.

La aplicación permitirá registrar árboles plantados durante actividades de restauración ecológica, organizando los registros según la jerarquía **Plantación → Parcela → Grupo → Árbol**. Una plantación se divide en **Parcelas** (subdivisiones físicas del terreno), cada Parcela contiene **Grupos** (que representan normalmente **líneas de plantación**), y cada Grupo agrupa los registros de **Árboles**.

El sistema está diseñado bajo el paradigma **offline-first**, lo que significa que toda la carga de datos ocurre localmente en el dispositivo y luego se sincroniza con una base de datos central cuando hay conectividad disponible.

La **Fase 1 (MVP)** será utilizada durante la **plantación de otoño 2026 de Bayka**, con el objetivo de validar el sistema en condiciones reales de campo.

La arquitectura está preparada para soportar **múltiples organizaciones en el futuro**, aunque en esta fase inicial existirá una sola organización: **Bayka**.

---

# 2. Conceptos Principales del Sistema

El sistema se estructura alrededor de las siguientes entidades conceptuales:

```
Organización
Usuario
Especie
Plantación
Parcela
Grupo
Árbol
```

La jerarquía de datos es:

```
Plantación → Parcela → Grupo → Árbol
```

> Nota histórica: hasta la v1.0 el nivel intermedio se llamaba **SubGrupo** y colgaba directamente de la Plantación (Plantación → SubGrupo → Árbol). En la v1.1 (Phase 16) el SubGrupo se renombró a **Grupo** y se incorporó el nivel intermedio **Parcela**, quedando el Grupo como hijo de la Parcela.

---

## Organización

Una organización representa una entidad que utiliza el sistema.

Ejemplos posibles:

- Bayka
- Otras ONGs de restauración ecológica
- Proyectos de reforestación independientes

En el MVP existirá una única organización:

```
Bayka
```

En el futuro el sistema podrá soportar múltiples organizaciones.
En esta etapa Fase 1 (MVP), esto deberá ser transparente para el usuario.
Todos los usuarios en el MVP estarán asociados a Bayka.

---

## Usuario

Los usuarios pertenecen a una o más organizaciones.

Existen dos tipos de usuario:

### Admin

Puede:

- Crear plantaciones
- Configurar las especies disponibles en una plantación
- Asignar técnicos a plantaciones
- Finalizar plantaciones
- Generar IDs finales
- Exportar datos de plantaciones

---

### Técnico

Puede:

- Registrar Parcelas
- Registrar Grupos
- Registrar árboles
- Resolver árboles N/N
- Sincronizar datos

Cada acción realizada queda asociada al usuario que la ejecutó.

---

## Especies

Las especies representan los tipos de árboles que pueden registrarse.

El catálogo de especies es **global** y se carga inicialmente mediante un **seed del sistema**.

En la Fase 1:

- los usuarios **no pueden crear especies**
- los usuarios **no pueden editar especies**

Cada especie tiene:

```
Código
Nombre común
Nombre científico (opcional)
```

Ejemplo:

```
ANC – Anchico – Parapiptadenia rigida
IBI – Ibirá Pitá – Peltophorum dubium
```

Las especies disponibles para registrar en campo se seleccionan **por plantación**.

---

## Plantación

Una plantación representa un evento de restauración que ocurre en un lugar y período determinado.

Ejemplo:

```
Lugar: La Maluka - Zona Alta Lote 1
Periodo: Otoño 2026
```

Una plantación es un conjunto de **Parcelas**.

Los administradores configuran qué especies estarán disponibles para registrar en campo.
Se eligen especies al crear la plantación.
Pueden habilitarse más especies luego durante el transcurso de la plantación.

Los técnicos asignados a la plantación pueden registrar Parcelas y Grupos.

---

## Parcela

Una **Parcela** es una subdivisión física de la plantación. Una plantación
está compuesta por un conjunto de Parcelas, y cada Parcela contiene múltiples
**Grupos**.

Cada Parcela tiene un **código** que debe ser **único dentro de la plantación**.

Ejemplos:

```
Parcela A
Parcela B
```

---

## Grupo

Un **Grupo** representa un subconjunto de árboles dentro de una **Parcela**.
Es el nivel hijo de la Parcela y normalmente corresponde a una **línea de
plantación**.

Ejemplos:

```
Linea 23
Linea 23B
```

Cada Grupo contiene múltiples registros de árboles.

Los Grupos son la **unidad de sincronización del sistema**.

> Anteriormente esta entidad se llamaba **SubGrupo** y colgaba directamente de
> la Plantación. Desde la v1.1 se llama **Grupo** y es hijo de una Parcela.

---

## Árbol

Cada registro de árbol representa un árbol plantado observado en campo.

Los árboles se registran utilizando una **interfaz de botones de especies**.

Cada registro incluye:

- especie
- foto opcional
- posición dentro del Grupo
- SubID
- IdPlantacion -> id dentro de la plantación numérico incremental secuencial, generado automáticamente al finalizar la plantación
- IdGeneral -> id dentro de la organización numérico incremental secuencial. Generado al finalizar la plantación a partir de un número seed (sugerir el ID n+1 como seed, basándose en el mayor ID registrado en el sistema)
- usuario que lo registró

---

# 3. Principios de Arquitectura

La aplicación sigue los siguientes principios:

### Operación offline-first

Toda la carga de datos ocurre localmente en el dispositivo.

---

### Sincronización manual

El usuario decide cuándo sincronizar los datos.

---

### Unidad de sincronización = Grupo

Los Grupos se sincronizan completos para evitar inconsistencias parciales.

---

### Datos sincronizados son inmutables

Una vez sincronizado un Grupo:

- no puede editarse
- no puede modificarse

---

# 4. Módulos Funcionales

---

# 4.1 Autenticación de Usuarios

Los usuarios acceden a la aplicación mediante:

```
email
contraseña
```

La autenticación se gestiona mediante **Supabase Auth**.

La sesión se mantiene persistente entre aperturas de la aplicación.

Un mismo dispositivo puede ser utilizado por distintos usuarios iniciando sesión.

Para simplificar el MVP, se pensó en generar los usuarios desde un seed incial. Dos admin y dos técnicos. Es posible con Supabase Auth?

## Gestión de usuarios
- Los usuarios del sistema tendrán una cuenta individual (email y contraseña).
- En Fase 1, los usuarios serán creados desde la base de datos
- Los usuarios podrán iniciar sesión desde la aplicación móvil.
- Cada registro de Grupo y árbol quedará asociado al usuario que lo registró.
- Un mismo dispositivo puede ser utilizado por distintos usuarios iniciando sesión con diferentes cuentas.
- Un usuario técnico solo podrá editar Grupos que él haya cargado

## Cuentas guardadas

La pantalla de login incluye un checkbox **"Recordar cuenta"** entre el campo de contraseña y el botón de inicio de sesión. Este checkbox está **activado por defecto**.

Cuando el checkbox está activado y el login es exitoso, el email y la contraseña se guardan **encriptados en SecureStore** del dispositivo.

En visitas posteriores a la pantalla de login:

- Las cuentas guardadas se muestran como **chips tocables** debajo del botón de login, bajo el título **"Cuentas guardadas"**.
- Al tocar un chip, se autocompletan los campos de email y contraseña.
- Se pueden guardar **múltiples cuentas** (útil para dispositivos compartidos en campo).
- El último email utilizado se **precarga automáticamente** en el campo de email.


---

# 4.2 Dashboard

Luego de iniciar sesión el usuario ve un listado de plantaciones disponibles.

Los técnicos solo ven las plantaciones a las que fueron asignados.

Ejemplo:

```
Plantaciones

• Otoño 2026 – La Maluka
• Restauración Misiones
```

Para cada plantación el usuario podrá ver:
- Cantidad de árboles totales registrados y sincronizados.
- Cantidad de árboles registrados por él sin sincronizar.
- Cantidad total de árboles registrados por él en la plantación.
- Cantidad de árboles registrados por el en el día.

---

# 4.3 Creación de Plantación (Admin)

Los administradores pueden crear plantaciones.

Datos requeridos:

```
Lugar
Periodo
```

Luego de crear la plantación el administrador debe:

- seleccionar especies disponibles
- asignar usuarios (perfiles admin o técnicos pertenecientes a la organización)

---

# 4.4 Configuración de Especies de la Plantación

El administrador selecciona especies del catálogo global.

Estas especies aparecerán como botones en la interfaz de registro.

Normalmente se mostrarán aprox **20 especies**.

El administrador también puede definir el **orden de los botones**. Por defecto tienen el orden en que fueron agregados.

---

# 4.5 Asignación de Técnicos

Los administradores asignan técnicos a la plantación.

Solo los técnicos asignados verán la plantación en su dashboard.

---

# 4.6 Gestión de Parcelas y Grupos

Los técnicos crean Parcelas para subdividir la plantación, y dentro de cada
Parcela crean Grupos al comenzar a registrar una línea.

Cada Grupo contiene:

```
Nombre (ej "Linea 23)
Código (ej L23)
Parcela a la que pertenece
Estado
Usuario creador
```

Ejemplo:

```
Parcela: A
Nombre: Linea 23B
Código: L23B
```

Reglas de unicidad de códigos:

- El **código de Parcela** debe ser **único por plantación**.
- El **código de Grupo** debe ser **único por parcela** (un mismo código de
  grupo puede repetirse en parcelas distintas de la misma plantación). No es
  único a nivel plantación.
- Lo que debe ser **único en toda la plantación** es la **combinación**
  (código de parcela + código de grupo).

Al crear un nuevo Grupo, se debe mostrar al usuario el nombre del último Grupo que generó.

---

## Estados de Grupo

Los Grupos tienen los siguientes estados:

```
activa
finalizada
sincronizada
```

---

### activa

El Grupo se está registrando activamente.

---

### finalizada

El técnico finalizó el registro de árboles.

---

### sincronizada

El Grupo fue sincronizado con el servidor.

Una vez sincronizado:

- no puede editarse
- no puede modificarse

---

# 4.7 Registro de Árboles

Los árboles se registran mediante una **botonera de especies**.

Cada botón representa una especie.

Al presionar un botón:

```
se crea un registro de árbol
se incrementa la posición automáticamente
```

Ejemplo:

```
1 ANC
2 IBI
3 ANC
4 TIM
```

La pantalla de carga de árboles deberá mostrar, además de la botonera: últimos 3 árboles registrados.

---

# 4.8 Datos de Árbol

Cada árbol contiene:

```
Especie
Foto opcional
Posición dentro del Grupo
SubID
IdPlantacion (se genera al finalizar plantación)
IdGeneral (se genera al finalizar plantación)
Usuario que registró
```

---

# 4.9 Generación de SubID

Cada árbol genera un identificador llamado **SubID**.

Formato:

```
CodigoParcela + CodigoGrupo + CodigoEspecie + Posicion
```

Ejemplo:

```
AL23BANC12
```

Significa:

```
Parcela: A
Grupo: L23B
Especie: ANC
Árbol número: 12
```

---

# 4.10 Árboles No Identificados (N/N)

Cuando un técnico no puede identificar la especie:

puede registrar el árbol como:

```
N/N
```

Se destinará un botón extra en la botonera de carga a este fin

Reglas:

- la foto es **obligatoria**
- el registro debe resolverse (identificar la especie) antes de sincronizar

---

# 4.11 Pantalla de Resolución de N/N

Existe una pantalla para revisar registros N/N.

Flujo:

```
Mostrar registro NN
Mostrar foto
Seleccionar especie correcta
Guardar
Pasar al siguiente NN
```

Hasta que todos los N/N se resuelvan, el Grupo no puede sincronizarse.

---

# 4.12 Botón "Revertir Orden"

Si una línea fue registrada en sentido inverso, se puede revertir el orden.

Ejemplo:

Orden original:

```
1 ANC
2 IBI
3 TIM
```

Luego de revertir:

```
1 TIM
2 IBI
3 ANC
```

Esto recalcula las posiciones.

Solo se permite antes de sincronizar.

---

# 4.13 Fotos

Las fotos pueden obtenerse de:

```
cámara
galería
```

Reglas:

- obligatorias para N/N
- opcionales para otras especies

Las fotos se almacenan localmente.

---

# 4.14 Sincronización

La sincronización es manual.

Cuando el usuario la inicia se envía al servidor:

```
Grupo
Árboles
```

Un Grupo solo puede sincronizarse si:

```
estado = finalizada
y no existen N/N sin resolver
```

---

## Conflictos de sincronización

Si ya existe un Grupo con la misma combinación (código de parcela + código de grupo) en la plantación:

```
la sincronización se rechaza
```

El usuario deberá resolver el conflicto manualmente.

---

# 4.15 Descarga de Datos

Durante la sincronización también se descargan datos actualizados:

```
Parcelas
Grupos
Árboles
Especies disponibles en la botonera
```

Esto permite ver registros cargados por otros técnicos.

---

# 4.16 Finalización de Plantación

Los administradores finalizan la plantación cuando todos los Grupos están sincronizados.

Esto habilita la generación de IDs finales.

---

# 4.17 Generación de IDs Finales

Se generan dos identificadores.

---

## ID Parcial de Plantación

Secuencial dentro de la plantación.

Ejemplo:

```
1
2
3
4
```

---

## ID Global de Organización

Secuencial entre todas las plantaciones.

El administrador define un valor inicial (el sistema sugiere uno basado en registros anteriores almacenados en el servidor para la organización).

Ejemplo:

```
Seed inicial: 10456
```

Los IDs incrementan desde ese valor.

---

# 4.18 Exportación de Datos

Los administradores pueden exportar la plantación a CSV o Excel.
Funcionalidad disponible para plantaciones finalizadas.

Columnas exportadas:

```
ID Global
ID Parcial
Zona (Lugar)
Parcela
Grupo
SubID
Periodo
Especie
```

---

# 5. Reglas de Operación en Campo

Cada Grupo es registrado por un único técnico.

Múltiples técnicos pueden trabajar simultáneamente en una plantación.

Cada técnico registra Grupos distintos.

Los Grupos deben completarse antes de sincronizar.

Una vez sincronizados, no pueden modificarse.

---

# 6. Limitaciones de la Fase 1

El MVP no incluye:

```
sincronización automática
resolución avanzada de conflictos
edición de registros sincronizados
gestión de especies desde la app
interfaz multi-organización
exportaciones GIS
registro GPS de árboles
```

Estas funcionalidades pueden evaluarse en fases futuras.

---

# 7. Extensibilidad Futura

La arquitectura permite agregar:

```
múltiples organizaciones
regiones de especies
coordenadas GPS
monitoreo ecológico (revisión en campo de plantaciones efectuadas anteriormente)
dashboards analíticos
```

---

# Objetivo principal del MVP

El objetivo de esta fase es **garantizar confiabilidad en el registro de datos en campo**, su sincronización online, y la exportación de estos datos a csv/excel.