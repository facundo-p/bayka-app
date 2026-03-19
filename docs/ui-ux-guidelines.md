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
manos sucias o con guantes
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
cambiar de SubGrupo
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

El usuario administrador utiliza la aplicación para:

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

Los botones deben ser lo suficientemente grandes para usarse con guantes.

Especialmente en la pantalla de registro de árboles.

---

## Feedback inmediato

Cada acción del usuario debe generar una respuesta visible.

Ejemplos:

```
animación de registro de árbol
contador que incrementa
confirmación visual
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

La paleta de colores definitiva **no está definida en esta fase**.

Por ahora se utilizará una paleta simple.

Posteriormente se definirá un diseño visual más específico.

---

# 6. Tipografía

La tipografía debe ser:

```
legible
clara
sin estilos complejos
```

Priorizar tamaño suficiente para lectura en exteriores.

---

# 7. Diseño de la Botonera de Especies

La botonera es la interfaz más importante del sistema.

Debe cumplir:

```
botones grandes
grid simple
máximo 20 especies
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

Flujo típico:

```
Dashboard
↓
Plantación
↓
SubGrupo
↓
Registro de árboles
```

Evitar estructuras de navegación profundas.

---

# 11. Indicadores de Estado

La aplicación debe mostrar claramente:

```
SubGrupo en registro
SubGrupo finalizado
SubGrupo sincronizado
```

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
cambio de SubGrupo
navegación
```

---

# 14. Errores

Los errores deben mostrarse de forma clara.

Ejemplos:

```
SubGrupo ya existe
NN sin resolver
sin conexión
```

Los mensajes deben ser simples y comprensibles.

---

# 15. Acciones irreversibles

Las acciones irreversibles deben mostrarse claramente.

Ejemplo:

```
sincronizar SubGrupo
```

Una vez sincronizado:

```
no se puede editar
```

Esto debe comunicarse al usuario.

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
abrir SubGrupo
registrar árboles
finalizar
sincronizar
```

La interfaz debe apoyar este flujo de forma natural.

---

# 18. Cuentas Guardadas en Login

En contextos de campo, un mismo dispositivo puede ser utilizado por distintos técnicos a lo largo del día.

Para facilitar el cambio de usuario:

```
la pantalla de login muestra cuentas guardadas como chips tocables
debajo del botón de inicio de sesión
```

Comportamiento:

```
checkbox "Recordar cuenta" activado por defecto
al iniciar sesión exitosamente, se guarda la cuenta
las cuentas guardadas aparecen como chips bajo "Cuentas guardadas"
tocar un chip autocompleta email y contraseña
el último email utilizado se precarga en el campo de email
```

Este patrón reduce la necesidad de escribir credenciales repetidamente, lo cual es especialmente valioso en campo donde la escritura manual es lenta e incómoda.