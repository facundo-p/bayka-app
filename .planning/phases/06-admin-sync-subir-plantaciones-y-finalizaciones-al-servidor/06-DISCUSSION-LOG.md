# Phase 6: Admin sync - subir plantaciones y finalizaciones al servidor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 06-admin-sync-subir-plantaciones-y-finalizaciones-al-servidor
**Areas discussed:** Descubrimiento de plantaciones, Seleccion de plantaciones, Trigger y flujo de descarga, Impacto en tecnico vs admin

---

## Descubrimiento de plantaciones

### Q1: Como deberia un dispositivo nuevo descubrir las plantaciones del servidor?

| Option | Description | Selected |
|--------|-------------|----------|
| Pull automatico al login | Despues de iniciar sesion, descarga automaticamente la lista | |
| Boton 'Actualizar' en pantalla | Boton visible para buscar plantaciones nuevas en el servidor | |
| Pantalla dedicada de descarga | Pantalla separada tipo 'catalogo' donde el usuario elige cuales descargar | ✓ |

**User's choice:** Pantalla dedicada de descarga
**Notes:** None

### Q2: Donde se accede a esta pantalla de catalogo?

| Option | Description | Selected |
|--------|-------------|----------|
| Boton en pantalla de plantaciones | Boton siempre visible en la pantalla principal | ✓ |
| Solo si lista vacia | Se muestra automaticamente si no hay plantaciones locales | |
| Tab o seccion separada | Tab dedicado en la navegacion | |

**User's choice:** Boton en pantalla de plantaciones
**Notes:** El usuario propuso reutilizar el icono de conectividad existente en el header de PlantacionesScreen. Online = tappable (abre catalogo), offline = grisado/deshabilitado. Dual-function: indica estado de conexion + da acceso al catalogo.

### Q3: Que info deberia mostrar cada plantacion en el catalogo?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimo: lugar + periodo + estado | Solo campos basicos | |
| Con stats: lugar + periodo + estado + arboles + subgrupos | Agrega metricas del servidor | |
| Con indicador de 'ya descargada' | Igual que anterior + marca las que ya estan locales | ✓ |

**User's choice:** Con indicador de 'ya descargada'
**Notes:** None

---

## Seleccion de plantaciones

### Q1: Como elige el usuario cuales plantaciones descargar?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap individual por plantacion | Boton 'Descargar' por plantacion | |
| Checkboxes + boton 'Descargar seleccion' | Marca varias y descarga batch | ✓ |
| Descargar todas automaticamente | Sin seleccion manual | |

**User's choice:** Checkboxes + boton 'Descargar seleccion'
**Notes:** None

### Q2: Que pasa con plantaciones ya descargadas?

| Option | Description | Selected |
|--------|-------------|----------|
| Ya descargadas no seleccionables | Se muestran pero no se pueden seleccionar | ✓ |
| Re-descargable para actualizar | Se pueden re-seleccionar para forzar actualizacion | |
| Boton separado de actualizar | Accion distinta para descarga nueva vs actualizacion | |

**User's choice:** Ya descargadas no seleccionables
**Notes:** None

---

## Trigger y flujo de descarga

### Q1: Que datos se descargan?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo metadata de plantacion | Plantacion + species + users. Subgrupos/arboles via sync despues | |
| Plantacion + subgrupos + arboles | Descarga completa, todo offline inmediatamente | ✓ |
| Plantacion + subgrupos (sin arboles) | Subgrupos para progreso, arboles bajo demanda | |

**User's choice:** Plantacion + subgrupos + arboles
**Notes:** None

### Q2: Como se muestra el progreso?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal con barra de progreso | Modal bloqueante con progreso, consistente con sync actual | ✓ |
| Indicador inline no bloqueante | Spinner por plantacion, usuario puede navegar | |
| Toast simple al completar | Sin progreso visual, solo mensaje final | |

**User's choice:** Modal con barra de progreso
**Notes:** None

---

## Impacto en tecnico vs admin

### Q1: El catalogo muestra las mismas plantaciones para ambos roles?

| Option | Description | Selected |
|--------|-------------|----------|
| Tecnico: solo asignadas / Admin: todas | Filtrado por rol, consistente con dashboard | ✓ |
| Ambos ven todas, tecnico descarga solo asignadas | Catalogo completo pero descarga filtrada | |
| Ambos ven y descargan todas | Sin filtro por rol | |

**User's choice:** Tecnico: solo asignadas / Admin: todas
**Notes:** None

### Q2: Admin al crear plantacion, aparece automaticamente local?

| Option | Description | Selected |
|--------|-------------|----------|
| Si, comportamiento actual | Crea en Supabase + SQLite local automaticamente | ✓ |
| No, siempre via catalogo | Incluso al crear, ir al catalogo para descargar | |

**User's choice:** Si, comportamiento actual
**Notes:** None

---

## Claude's Discretion

- Exact catalog screen layout and visual design
- Supabase query strategy for catalog list
- "Already downloaded" detection mechanism
- Progress modal implementation details
- Error handling for failed downloads
- Tree download strategy (by subgroup IDs or plantation ID)

## Deferred Ideas

None — discussion stayed within phase scope
