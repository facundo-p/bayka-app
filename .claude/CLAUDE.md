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