# domain-model.md
## Modelo de Dominio – Aplicación de Monitoreo de Plantaciones Bayka

Este documento describe el **modelo conceptual de datos** del sistema.

Define:

- Entidades principales
- Atributos
- Relaciones
- Cardinalidades
- Reglas de integridad
- Estados del sistema

Este documento es la referencia para:

- diseño de base de datos
- generación de schema SQL
- implementación de repositorios
- sincronización offline/online

---

# 1. Entidades del Dominio

El sistema se compone de las siguientes entidades principales:

```
Organización
Usuario
Especie
Plantación
SubGrupo
Árbol
Asignación de usuarios a plantación
Especies habilitadas por plantación
```

Representación simplificada:

```
Organización
 ├── Usuarios
 └── Plantaciones
        ├── SubGrupos
        │      └── Árboles
        └── Técnicos asignados
```

---

# 2. Organización

Representa una entidad que utiliza el sistema.

Ejemplo:

```
Bayka
```

En la Fase 1 solo existirá una organización.

### Atributos

```
id
nombre
fecha_creacion
```

### Relaciones

Una organización puede tener:

```
1:N usuarios
1:N plantaciones
```

---

# 3. Usuario

Representa una persona que utiliza el sistema.

Los usuarios pertenecen a una o más organizaciones.

### Roles

Existen dos roles:

```
admin
tecnico
```

### Atributos

```
id
email
password_hash
nombre
rol
fecha_creacion
```

### Relaciones

```
N:M organizaciones
N:M plantaciones (como técnico asignado)
1:N subgrupos creados
1:N árboles registrados
```

---

# 4. Especie

Representa un tipo de árbol.

Las especies son **globales al sistema**.

Se cargan inicialmente mediante un **seed**.

No se pueden modificar desde la aplicación en la Fase 1.

### Atributos

```
id
codigo
nombre
nombre_cientifico (opcional)
fecha_creacion
```

Ejemplo:

```
ANC – Anchico
IBI – Ibirá Pitá
LAP – Lapacho
```

### Relaciones

```
N:M plantaciones
```

Una plantación define qué especies están disponibles en su interfaz de registro.

---

# 5. Plantación

Representa un evento de restauración ecológica.

Ejemplo:

```
Otoño 2026 – La Maluka
```

### Atributos

```
id
organizacion_id
lugar
periodo
estado
fecha_creacion
creado_por
```

### Estados posibles

```
activa
finalizada
```

### Relaciones

```
N:1 organización
N:M usuarios técnicos
N:M especies
1:N subgrupos
```

---

# 6. Especies habilitadas por plantación

Define qué especies aparecen en la botonera de registro.

También define el orden de los botones.

### Atributos

```
plantacion_id
especie_id
orden_visual
```

### Relaciones

```
N:1 plantación
N:1 especie
```

---

# 7. Asignación de técnicos a plantación

Define qué técnicos pueden trabajar en una plantación.

### Atributos

```
plantacion_id
usuario_id
rol_en_plantacion
fecha_asignacion
```

### Roles posibles

```
admin
tecnico
```

---

# 8. SubGrupo

Un SubGrupo representa un subconjunto de árboles dentro de una plantación.

Normalmente corresponde a:

```
una línea de plantación
una parcela
```

Ejemplos:

```
Linea 23
Linea 23B
Parcela A
```

### Atributos

```
id
plantacion_id
nombre
codigo
tipo
estado
usuario_creador
fecha_creacion
```

### Tipos posibles

```
linea
parcela
```

### Estados posibles

```
activa
finalizada
sincronizada
```

### Relaciones

```
N:1 plantación
1:N árboles
N:1 usuario (creador)
```

### Restricciones

Dentro de una misma plantación:

```
Nombre de subgrupo debe ser único
codigo de subgrupo debe ser único
```

---

# 9. Árbol

Representa un árbol registrado en campo.

Los árboles pertenecen a un SubGrupo.

### Atributos

```
id
subgrupo_id
especie_id
posicion
foto_url (opcional)
sub_id
plantacion_id (ver # 17. ID Parcial de Plantación)
global_id (ver # 18. ID Global Bayka)
usuario_registro
fecha_creacion
```

### Relaciones

```
N:1 subgrupo
N:1 especie
N:1 usuario
```

---

# 10. Posición de árbol

Cada árbol tiene una posición dentro del SubGrupo.

La posición representa el orden de registro.

Ejemplo:

```
1
2
3
4
```

La posición se asigna automáticamente al registrar el árbol.

---

# 11. SubID

Cada árbol genera un identificador interno llamado **SubID**.

Formato:

```
codigo_subgrupo + codigo_especie + posicion
```

Ejemplo:

```
L23BANC12
```

Significa:

```
SubGrupo: L23B
Especie: ANC
Árbol número 12
```

---

# 12. Árboles no identificados (N/N)

Cuando un técnico no puede identificar una especie, puede registrarla como:

```
N/N
```

Reglas:

```
foto obligatoria
no puede sincronizarse hasta resolverse
```

---

# 13. Fotos

Las fotos pueden asociarse a un árbol.

### Atributos

```
foto_url
```

Las fotos se almacenan:

```
localmente (antes de sincronizar)
```

---

# 14. Sincronización

La unidad de sincronización del sistema es el **SubGrupo**.

Cuando un SubGrupo se sincroniza:

```
se envían todos los árboles asociados
se suben las fotos
```

### Condiciones para sincronizar

```
estado = finalizada
no existen árboles NN
```

---

# 15. Inmutabilidad de datos sincronizados

Una vez sincronizado un SubGrupo:

```
no puede editarse
no pueden modificarse sus árboles
```

Esto garantiza consistencia del dataset final.

---

# 16. Finalización de plantación

Una plantación puede finalizarse cuando:

```
todos los subgrupos están sincronizados
```

Luego se generan los IDs finales (de plantación y global).

---

# 17. ID Parcial de Plantación

Secuencial dentro de la plantación.

Ejemplo:

```
1
2
3
4
```

---

# 18. ID Global de Organización

Secuencial entre todas las plantaciones.

El administrador define un valor inicial.

Ejemplo:

```
Seed inicial = 10456
```

Los IDs incrementan desde ese valor.

---

# 19. Reglas de integridad

Reglas críticas del sistema:

```
SubGrupo.codigo único dentro de una plantación
Árbol.posicion única dentro de un subgrupo
SubGrupo sincronizado no puede editarse
NN requiere foto
SubGrupo con NN no puede sincronizar
```

---

# 20. Cardinalidades resumidas

```
Organización 1:N Usuarios
Organización 1:N Plantaciones

Plantación 1:N SubGrupos
Plantación N:M Usuarios
Plantación N:M Especies

SubGrupo 1:N Árboles

Árbol N:1 Especie
Árbol N:1 Usuario
```

---

# 21. Resumen del modelo

Representación general:

```
Organización
 ├── Usuarios
 └── Plantaciones
        ├── Técnicos asignados
        ├── Especies habilitadas
        └── SubGrupos
               └── Árboles
```

---

# Objetivo del modelo

Este modelo busca:

- garantizar consistencia de datos
- facilitar operación offline
- permitir sincronización segura
- soportar futuras extensiones del sistema