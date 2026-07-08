# Decisión: `plantations.visible_in_app` es UX, no una frontera de seguridad

Estado: **decidido** · Alcance: web de gestión + Bayka App + Supabase RLS

## Contexto

La migración `024_web_admin.sql` agrega `plantations.visible_in_app boolean not null
default true`. La web de gestión permite a un admin marcar una plantación como
oculta; la Bayka App muestra a los técnicos solo las visibles y a los admins todas
(con un chip "Oculta en app").

Durante el CR de #199 se detectó que **ninguna policy RLS filtra por esa columna**:
el ocultamiento se aplica solo del lado del cliente. La pregunta (#208) fue si
`visible_in_app` debía ser una **frontera de seguridad** (RLS) o un **toggle de UX**.

## Hallazgo que decide la cuestión

La policy de lectura de `plantations` (`001_initial_schema.sql`) es:

```sql
create policy "Authenticated users can read plantations"
  on plantations for select
  to authenticated
  using (true);
```

Es decir: **cualquier usuario autenticado puede leer TODAS las plantaciones** por API
directa, sin importar su rol, su organización ni `visible_in_app`. El aislamiento por
organización y por asignación **no está en RLS** hoy: se resuelve del lado del cliente
(el `downloadService`/`catalogQueries` de mobile filtran y el técnico solo persiste
localmente lo que descargó).

Sobre ese modelo, hacer que **solo** `visible_in_app` sea una frontera de seguridad
sería incoherente y engañoso ("security theater"): un técnico con cliente modificado o
llamada directa ya puede leer plantaciones de otras organizaciones y datos que no le
corresponden, mucho más allá de las ocultas. Cerrar la puerta de `visible_in_app`
dejando abierta la del aislamiento por organización no aporta seguridad real.

## Decisión

`visible_in_app` es un **toggle de UX** para descongestionar el listado del técnico en
la Bayka App. **No es una frontera de seguridad** y no debe asumirse como tal. No se
agrega policy RLS por esta columna.

## Consecuencias

- El ocultamiento sigue siendo client-side (mobile). Un cliente modificado puede ver
  plantaciones ocultas: es aceptable porque no son datos sensibles cuya exposición
  cambie el modelo de amenaza (ya son visibles vía el `using (true)` general).
- El flujo actual "admin ve las ocultas, técnico no" se mantiene sin cambios y sin
  riesgo de romper la visibilidad del admin.

## Consideración de seguridad mayor (fuera del alcance de #208, pero registrada)

El verdadero pendiente de seguridad **no es** `visible_in_app` sino que la lectura de
`plantations` (y probablemente parcelas/grupos/árboles) es `using (true)`: **no hay
aislamiento por organización ni por rol a nivel de base de datos**. Si en el futuro se
requiere que un técnico no pueda leer datos de otra organización por API directa, hay
que rediseñar las policies de `SELECT` de forma coherente en toda la jerarquía
(plantations → parcelas → grupos → trees), scopeando por `organizacion_id` y por
asignación (`plantation_users`). Recién sobre ese piso tendría sentido — si el negocio
lo pide — sumar `visible_in_app` como criterio adicional para el rol técnico.

Esa reforma es un cambio grande, requiere validar que la sincronización mobile
(admin ve ocultas, técnico no) siga funcionando, y debe pasar por revisión de producto
y seguridad. No se aborda acá.

## Si esta decisión cambiara

Convertir `visible_in_app` en frontera de seguridad implicaría, como mínimo:

1. Rediseñar antes el aislamiento por organización/asignación en RLS (sin eso, no
   suma seguridad).
2. Una policy `SELECT` en `plantations` que, para rol `tecnico`, exija
   `visible_in_app = true`; y `admin`/`superadmin` sin ese filtro.
3. Coherencia en parcelas/grupos/árboles (no exponer hijos de una plantación oculta).
4. Verificar que la sincronización mobile del admin siga trayendo las ocultas.
