# ui-ux-guidelines.md
## Guías de Interfaz y Usabilidad

Este documento define principios de diseño para la interfaz de usuario de la aplicación de monitoreo de plantaciones.

Su objetivo es garantizar que la interfaz sea:

```
simple
rápida
robusta en campo
intuitiva
```

Estas guías deben respetarse durante el desarrollo.

---

# 1. Contexto de Uso

La aplicación será utilizada en condiciones de campo.

Esto implica:

```
usuarios caminando
uso bajo luz solar fuerte
poco tiempo para interactuar con la pantalla
```

Por lo tanto:

```
la interfaz debe minimizar la cantidad de interacciones necesarias
```

Las acciones principales deben poder realizarse con **uno o dos toques**.

---

# 2. Perfil de Usuario Técnico

El perfil técnico utiliza la aplicación principalmente para:

```
registrar árboles
cambiar de Grupo
resolver N/N
sincronizar datos
```

La interfaz del técnico debe ser:

```
muy simple
sin distracciones
sin configuraciones complejas
```

Las pantallas del técnico deben mostrar **solo lo necesario para la tarea actual**.

---

# 3. Perfil de Usuario Admin

El usuario administrador utiliza la aplicación para todo lo que hace el perfíl técnico más:

```
crear plantaciones
configurar especies
asignar técnicos
exportar datos
finalizar plantaciones
```

Las pantallas de administración pueden tener más opciones, pero deben seguir siendo claras y ordenadas.

---

# 4. Principios de Diseño

## Simplicidad

Cada pantalla debe tener **un objetivo claro**.

Evitar interfaces con demasiados controles.

---

## Acciones visibles

Las acciones principales deben ser visibles.

Evitar menús ocultos innecesarios.

---

## Botones grandes

Los botones en la pantalla de registro de árboles deben ser lo suficientemente grandes para presionarse con facilidad.

---

## Feedback inmediato

Cada acción importante del usuario debe generar feedback.

Ejemplos:

```
vibración al registrar un árbol
contador que incrementa
modals de confirmación + toast/mensaje de éxito/error
```

---

## Minimizar escritura

Evitar requerir escritura manual.

Priorizar:

```
botones
selectores
listas
```

---

# 5. Paleta de Colores

La paleta está **definida según el manual de marca de Bayka** y centralizada en
`mobile/src/theme.ts` (objeto `colors`). **Fuente única de verdad:** ningún color
se hardcodea en pantallas o componentes — siempre se importa de `theme.ts`
(ver regla 8 de `CLAUDE.md`).

## Colores de marca

```
primary    #0A3760  azul oscuro Bayka — acciones principales, headers,
                    splash y fondo del ícono de Android
secondary  #99B95B  verde oliva Bayka — estados activos, acentos,
                    indicador "online" y conteos
```

## Roles semánticos

```
danger      #DC2626  acciones destructivas / errores
info        #2563EB  información
syncPending #F97316  pendiente de sincronización (OrangeDot)
```

## Jerarquía de texto

```
textHeading    #0A3760  títulos (azul de marca)
textPrimary    #1E293B  cuerpo
textSecondary  #475569  texto secundario
textMuted      #94A3B8  placeholder / metadatos
```

## Chips de estado

```
activa      verde oliva (#99B95B)
finalizada  azul de marca (#0A3760)
```

> El detalle completo de tokens (variantes de marca, superficies, bordes, chips,
> stats, conectividad) vive en `theme.ts`. Este documento describe la intención;
> `theme.ts` es la referencia normativa.

---

# 6. Tipografía

Las tipografías están **definidas por el manual de marca de Bayka** (sección
"Fuentes"). Se cargan al inicio de la app (`useFonts` en `app/_layout.tsx`,
bloqueando el splash hasta que estén listas). Tokens en `theme.ts` (objeto `fonts`).

## Fuentes de marca

```
Títulos / destacados   Linux Biolinum Regular   (LinBiolinum_R / _RB, .otf local)
                        → headers de navegación, títulos de pantalla y de modales,
                          nombres de tarjetas
Cuerpo / bajada        Meta Plus Normal Roman   (tipografía complementaria del manual)
Códigos / IDs          monospace del sistema    (código de especie, SubID)
```

> **Nota de implementación:** el cuerpo se renderiza hoy con **Poppins** (Google
> Fonts, 5 pesos) como sustituto libre de Meta Plus Normal Roman, que es una fuente
> comercial. Linux Biolinum (títulos) sí coincide con el manual. La alineación de la
> fuente de cuerpo con la marca está registrada como issue aparte.

## Escala de tamaños

Definida en `theme.ts` (`fontSize`), de `xxs` (10) a `hero` (32). Priorizar tamaño
suficiente para lectura en exteriores — el cuerpo base es 15.

---

# 7. Diseño de la Botonera de Especies

La botonera es la interfaz más importante del sistema.

Debe cumplir:

```
botones grandes
grid simple
```

Cada botón debe mostrar:

```
código de especie (grande)
nombre completo (pequeño)
```

Ejemplo:

```
ANC
Anchico
```

---

# 8. Registro de Árboles

El registro debe ser extremadamente rápido.

Flujo esperado:

```
presionar botón de especie
↓
árbol registrado
↓
contador incrementa
```

No debe requerir confirmaciones adicionales.

---

# 9. Revisión de N/N

La interfaz para revisar N/N debe ser muy simple.

Flujo:

```
mostrar foto
mostrar selector de especie
guardar
siguiente N/N
```

No debe requerir navegación compleja.

---

# 10. Navegación

La navegación debe ser simple.

Flujo típico (igual para admin y técnico):

```
Plantaciones (lista)
↓
Parcelas (de la plantación)
↓
Grupos (de la parcela)
↓
Registro de árboles
```

El nivel **Parcela** es obligatorio: no se llega a los Grupos sin seleccionar
antes una parcela (la pantalla de grupos redirige a Parcelas si no hay parcela en
contexto). Evitar estructuras más profundas que esta.

---

# 11. Indicadores de Estado

La aplicación debe mostrar claramente el estado de cada Grupo:

```
activa       (en registro)
finalizada   (cerrado, listo para sincronizar)
```

El Grupo tiene **dos** estados (`activa`, `finalizada`). La sincronización NO es
un tercer estado: lo pendiente de subir se indica aparte con un punto naranja
(OrangeDot, `pendingSync`) sobre la tarjeta del Grupo y de la Parcela.

Los estados deben ser visibles en las listas.

---

# 12. Sincronización

La sincronización debe ser explícita.

El usuario debe poder ver:

```
SubGrupos pendientes de sincronización
estado de sincronización
```

La sincronización nunca debe iniciarse automáticamente.

---

# 13. Rendimiento

La aplicación debe ser rápida.

La interfaz no debe bloquearse durante operaciones comunes.

Especialmente durante:

```
registro de árboles
cambio de Grupo
navegación
```

---

# 14. Errores

Los errores deben mostrarse de forma clara.

Ejemplos:

```
Grupo ya existe (el código es único por parcela)
NN sin resolver
sin conexión
```

Los mensajes deben ser simples y comprensibles.

---

# 15. Acciones irreversibles

Las acciones irreversibles o bloqueantes deben mostrarse claramente.

Ejemplo:

```
sincronizar Grupo
```

Una vez sincronizado, el Grupo queda bloqueado para edición. Un admin o el
creador puede **reactivarlo** explícitamente si necesita corregirlo; esa
reactivación también debe comunicarse con claridad.

---

# 16. Evitar complejidad innecesaria

La interfaz no debe incluir:

```
animaciones complejas
configuraciones avanzadas
menús profundos
```

El objetivo principal es **registro rápido y confiable en campo**.

---

# 17. Objetivo principal de la interfaz

La interfaz debe permitir que un técnico registre árboles **sin tener que pensar demasiado**.

El flujo ideal es:

```
abrir plantación
seleccionar parcela
abrir grupo
registrar árboles
finalizar
sincronizar
```

La interfaz debe apoyar este flujo de forma natural. La selección de Parcela es
un paso real del flujo (ver §10), no opcional.

---

# 18. Cuentas Guardadas en Login

En contextos de campo, un mismo dispositivo puede ser utilizado por distintos técnicos a lo largo del día.

Para facilitar el cambio de usuario:

```
la pantalla de login muestra cuentas guardadas como chips tocables
debajo del botón de inicio de sesión
```

Comportamiento (implementado):

```
al iniciar sesión exitosamente, la cuenta se guarda automáticamente (no hay checkbox)
las cuentas guardadas aparecen como chips bajo el rótulo "Acceso rápido"
tocar un chip autocompleta email y contraseña
```

Este patrón reduce la necesidad de escribir credenciales repetidamente, lo cual es especialmente valioso en campo donde la escritura manual es lenta e incómoda.

---

# 19. Tareas atómicas: no fragmentar lo que es una sola acción

**Principio:** evitar dividir en varios pasos manuales una tarea que **puede** —y
por lógica de negocio **tiene sentido que**— realizarse en un solo paso.

Si el usuario percibe "una acción" pero la interfaz le exige varios toques o
pantallas encadenadas **cuya separación no aporta una decisión ni un control
real**, es un olor de diseño. La pregunta de control es:

```
¿la separación le da al usuario una decisión o un control que de verdad
necesita? → la separación es legítima
¿es solo fricción / un detalle de implementación que se filtró a la UI? → unificar
```

## Separaciones legítimas (NO son olor)

Algunos pasos el negocio los separa a propósito, y eso es correcto:

- **Sincronización (ver §12):** es manual y deliberada. El técnico decide **qué**
  y **cuándo** subir. La separación agrega control real → se mantiene.

## Tareas que deben ser atómicas y autocontenidas

- **Generar IDs** es una tarea completa en sí misma: asigna los IDs y **persiste
  localmente**. Queda terminada sin depender de ningún paso posterior. La
  sincronización es una tarea **distinta y posterior** (decisión del técnico), no
  una continuación obligatoria de "generar IDs". La UI no debe dar a entender que
  los IDs están "a medio hacer" hasta sincronizar — están hechos y guardados.

## Regla práctica para el desarrollo

Antes de implementar o modificar un flujo, preguntarse: *"¿esto que le estoy
pidiendo al usuario en N pasos es en realidad una sola tarea?"* Si la separación
no se justifica por una decisión de negocio (como §12), unificarla en un solo paso.