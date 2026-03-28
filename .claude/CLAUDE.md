# Proyecto: EE360

## Reglas de trabajo

1. Planning obligatorio antes de código.
   - Dividir en tareas pequeñas.
   - Consultar decisiones importantes.
   - Detectar ambigüedades.
   - No implementar sin aprobación explícita.

2. Cada funcionalidad debe definir:
   - Comportamiento esperado
   - Criterios de verificación
   - Casos borde
   - Implementar y validar tests

3. Calidad de código
   - No duplicar código.
   - Refactor si función >20 líneas.
   - Separar lógica y presentación.
   - Actualizar archivos de documentación .md que hayan quedado desactualizados

4. Eficiencia
   - Preguntar si algo es ambiguo.
   - Minimizar consumo de contexto.
---

### 5. Estrategia de Subagentes
- Use subagents liberally to keep main context windows clean
- For complex problems, throw more compute at it via subagents

---

### 6. Self.Improvement Loop

- After ANY correction from the user: update 'tasks/lessons.md' with the pattern 
- Write rules for yourself that prevent the same mistake
 - Ruthlessly iterate on these lessons until mistake rate drops 
 - Review lessons at session start for relevant project 

--- 

### 7. GitHub Issues

- Don't assume. Ask questions if needed.
- When addressing an issue, update it with the plan(s) approved by user.
- When fishing an Issue, update it with the results and relevant considerations.
- When asking questions to the user, add the replies to issue description.
- For complex problems, create sub-issues and follow this same rules on them.

--- 

## Task Management 
1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items 
2. **Verify Plan**: Check in before starting implementation 
3. **Track Progress**: Mark items complete as you go 
4. **Explain Changes**: High-level summary at each step 
5. **Document Results**: Add review section to 'tasks/todo.md' 
6. **Capture Lessons**: Update 'tasks/lessons.md' after corrections

## Frontend Rules

- React funcional con hooks.
- Componentes pequeños y reutilizables.
- Sin inline styling.
- CSS separado y reutilizable.
- Parametrizar colores y variables comunes.

### 8. Diseño centralizado y código compartido (OBLIGATORIO)

**Colores, espaciado, tipografía y estilos comunes** DEBEN definirse en un único archivo de tema (`src/theme.ts`). Nunca hardcodear valores de color o tamaño directamente en los archivos de pantalla o componente. Si necesitás un color, importalo del tema.

**Cero código duplicado entre roles (admin/tecnico).** Las pantallas que comparten funcionalidad (plantaciones, subgrupos, perfil, etc.) DEBEN ser componentes compartidos en `src/components/` o `src/screens/`, parametrizados por rol si es necesario. Las carpetas `(admin)` y `(tecnico)` solo deben contener archivos de layout de navegación y wrappers mínimos que importen los componentes compartidos.

**Regla de un solo lugar:** Para cambiar un color, un estilo común, o un comportamiento compartido, debe ser necesario editar UN SOLO archivo. Si hay que tocar más de un archivo para un cambio de estilo, es un bug de arquitectura.

### 9. Separación lógica de datos y presentación (OBLIGATORIO)

**Cero queries en pantallas o componentes.** Las pantallas (`src/screens/`) y componentes (`src/components/`) NUNCA deben contener llamadas directas a `db.select()`, `db.insert()`, `db.update()`, `db.delete()` ni SQL inline. Toda lógica de acceso a datos debe estar en:
- `src/repositories/` — mutaciones (insert, update, delete) y queries de entidad
- `src/queries/` — queries de lectura complejas, estadísticas, agregaciones
- `src/services/` — lógica de negocio que coordina múltiples repositorios/queries

**Hooks como puente, no como lógica.** Los hooks (`src/hooks/`) pueden llamar a funciones de repositories/queries y gestionar estado reactivo (useLiveData), pero NO deben contener queries SQL raw. Si un hook necesita una query, esa query se define en `queries/` o `repositories/` y el hook la invoca.

**Queries reutilizables y testeables.** Si una query se usa en más de un lugar, DEBE estar en un archivo de queries. Si una query tiene lógica de negocio (filtros por rol, cálculos de fecha, estado), DEBE poder testearse unitariamente sin renderizar un componente.

**Regla práctica:** Si necesitás importar `db` o tablas del schema en un archivo de `screens/` o `components/`, es un code smell. Extraé la query a `queries/` o `repositories/`.