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
Parcela
Grupo
Árbol
Asignación de usuarios a plantación
Especies habilitadas por plantación
```

Representación simplificada:

```
Organización
 ├── Usuarios
 └── Plantaciones
        ├── Parcelas
        │      └── Grupos
        │             └── Árboles
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

Existen tres roles:

```
superadmin
admin
tecnico
```

`superadmin` (migración 024) es el único que puede gestionar usuarios y roles
desde la web de gestión; en el resto del sistema opera igual que `admin`.
`tecnico` no tiene acceso a la web de gestión.

### Atributos

```
id
email
password_hash
nombre
rol
activo
fecha_creacion
```

El email y la contraseña viven en Supabase Auth (`auth.users`); `profiles.email`
es una copia denormalizada que un trigger mantiene sincronizada (migración 026)
para que la web pueda listarlo con anon key. Al crear un auth user (dashboard o
invitación), el trigger `handle_new_user` crea el profile automáticamente con
defaults seguros (rol `tecnico`, organización Bayka).

`activo` implementa la baja reversible: desactivar un usuario marca
`activo = false` y lo banea en Auth (vía la edge function `admin-users`), sin
tocar sus datos de campo (árboles, grupos). No existe el hard-delete de
usuarios: las FKs de `trees`/`subgroups` lo impiden a propósito.

### Relaciones

```
N:M organizaciones
N:M plantaciones (como técnico asignado)
1:N grupos creados
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
descripcion (opcional)
fecha_inicio (opcional)
superficie_ha (opcional)
ubicacion_lat / ubicacion_lng (opcional, centroide aproximado)
objetivo_arboles (opcional, meta para dashboard)
visible_in_app (default true: si los técnicos la ven en la Bayka App)
gps_capture_frequency / gps_capture_required (configuración GPS, migración 023)
```

Los campos opcionales y la visibilidad se gestionan desde la web de gestión
(migración 024).

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
1:N parcelas
```

Una plantación es un conjunto de parcelas. Cada parcela agrupa, a su vez,
los grupos de árboles (ver # 8. Parcela y # 9. Grupo).

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

# 8. Parcela

Una Parcela es el **nivel intermedio** de la jerarquía: una plantación es un
conjunto de parcelas, y cada parcela agrupa a su vez los grupos de árboles.

La jerarquía actual es:

```
Plantación → Parcela → Grupo → Árbol
```

Ejemplos:

```
Parcela A
Parcela Norte
Lote 7
```

### Atributos

```
id
plantacion_id
nombre
codigo
descripcion (opcional)
fecha_creacion / actualizacion
deleted_at (soft-delete, NULL si está vigente)
```

> La Parcela **no** tiene columna `estado` ni `usuario_creador`: la auditoría de
> autoría es server-side (no se modela como atributo).

### Relaciones

```
N:1 plantación
1:N grupos
```

### Restricciones

Dentro de una misma plantación, vía **índices parciales únicos** `WHERE deleted_at IS NULL`:

```
codigo de parcela único  → (plantation_id, codigo)
nombre de parcela único  → (plantation_id, nombre)
```

La parcela usa **soft-delete**: al eliminarla se marca `deleted_at` en lugar de
borrar la fila. Los índices parciales hacen que una parcela eliminada no bloquee
reutilizar su código ni su nombre.

---

# 9. Grupo

Un Grupo representa un subconjunto de árboles dentro de una **parcela**.
Antiguamente esta entidad se llamaba **SubGrupo** (renombrada a "Grupo" en v1.1);
además dependía directamente de la plantación, no de la parcela.

Normalmente corresponde a:

```
una línea de plantación
```

Ejemplos:

```
Linea 23
Linea 23B
```

### Atributos

```
id
parcela_id
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
```

El estado real es `activa` | `finalizada` (lo que persiste el server y lo que
sube el sync sin hardcodear). "Sincronizado" se representa con `pendingSync =
false`, NO con un estado. `sincronizada` es un valor heredado/deprecado que ya no
se escribe pero puede existir en filas locales viejas (ver issue #60 y SPECS.md).

### Relaciones

```
N:1 parcela
1:N árboles
N:1 usuario (creador)
```

### Restricciones

El código de grupo es único **por parcela**, es decir sobre `(parcela_id,
codigo)`. **Puede repetirse entre parcelas** de la misma plantación.

Lo único dentro de la plantación es la **combinación** de código de parcela +
código de grupo:

```
codigo de grupo único por parcela
combinación (codigo_parcela + codigo_grupo) única por plantación
```

---

# 10. Árbol

Representa un árbol registrado en campo.

Los árboles pertenecen a un Grupo (que a su vez pertenece a una Parcela).

### Atributos

```
id
grupo_id
especie_id
posicion
foto_url (opcional)
sub_id
plantacion_id (ver # 18. ID Parcial de Plantación)
global_id (ver # 19. ID Global Bayka)
usuario_registro
fecha_creacion
```

### Relaciones

```
N:1 grupo
N:1 especie
N:1 usuario
```

---

# 11. Posición de árbol

Cada árbol tiene una posición dentro del Grupo.

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

# 12. SubID

Cada árbol genera un identificador interno llamado **SubID**.

Formato:

```
codigo_parcela + codigo_grupo + codigo_especie + posicion
```

Ejemplo:

```
PAL23BANC12
```

Significa:

```
Parcela: PA
Grupo: L23B
Especie: ANC
Árbol número 12
```

---

# 13. Árboles no identificados (N/N)

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

# 14. Fotos

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

# 15. Sincronización

La unidad de sincronización del sistema es el **Grupo**.

Cuando un Grupo se sincroniza:

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

# 16. Inmutabilidad de datos sincronizados

Una vez sincronizado un Grupo:

```
no puede editarse
no pueden modificarse sus árboles
```

Esto garantiza consistencia del dataset final.

---

# 17. Finalización de plantación

Una plantación puede finalizarse cuando:

```
todos los grupos están sincronizados
```

Luego se generan los IDs finales (de plantación y global).

---

# 18. ID Parcial de Plantación

Secuencial dentro de la plantación.

Ejemplo:

```
1
2
3
4
```

---

# 19. ID Global de Organización

Secuencial entre todas las plantaciones.

El administrador define un valor inicial.

Ejemplo:

```
Seed inicial = 10456
```

Los IDs incrementan desde ese valor.

---

# 20. Reglas de integridad

Reglas críticas del sistema:

```
Parcela.codigo único dentro de una plantación
Grupo.codigo único dentro de una parcela (puede repetirse entre parcelas)
Combinación (codigo_parcela + codigo_grupo) única dentro de una plantación
Árbol.posicion única dentro de un grupo
Grupo sincronizado no puede editarse
NN requiere foto
Grupo con NN no puede sincronizar
```

---

# 21. Cardinalidades resumidas

```
Organización 1:N Usuarios
Organización 1:N Plantaciones

Plantación 1:N Parcelas
Plantación N:M Usuarios
Plantación N:M Especies

Parcela 1:N Grupos

Grupo 1:N Árboles

Árbol N:1 Especie
Árbol N:1 Usuario
```

---

# 22. Resumen del modelo

Representación general:

```
Organización
 ├── Usuarios
 └── Plantaciones
        ├── Técnicos asignados
        ├── Especies habilitadas
        └── Parcelas
               └── Grupos
                      └── Árboles
```

---

# Objetivo del modelo

Este modelo busca:

- garantizar consistencia de datos
- facilitar operación offline
- permitir sincronización segura
- soportar futuras extensiones del sistema