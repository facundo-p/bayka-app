---
status: complete
phase: 02-field-registration
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-03-17T18:00:00Z
updated: 2026-03-18T10:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: App arranca sin errores, migraciones y seeds corren, llega al login.
result: pass

### 2. Lista de Plantaciones
expected: Técnico ve lista de plantaciones con la demo.
result: pass

### 3. Navegación a SubGrupos
expected: Tocar plantación navega a lista de SubGrupos con header correcto.
result: pass

### 4. Crear SubGrupo con validación
expected: Formulario con Nombre, Código, Tipo. Error inline si código duplicado.
result: pass

### 5. Lista de SubGrupos con chips de estado
expected: Chips verde=Activa, naranja=Finalizada, azul=Sincronizada.
result: pass

### 6. Grilla de especies 4 columnas
expected: 4 columnas, botones 60pt, N/N arriba en amarillo.
result: issue
reported: "Las últimas 2 especies de la fila ocupan el ancho de 2 casilleros cada una. Deberían verse todas iguales."
severity: cosmetic

### 7. Registro de árbol con un tap
expected: Un tap crea árbol, contador se actualiza, últimos 3 aparecen.
result: pass

### 8. Deshacer último árbol
expected: Solo el último tiene "Deshacer", al tocarlo se elimina.
result: pass

### 9. Registro N/N con foto obligatoria
expected: N/N abre cámara, cancelar no registra, foto crea árbol N/N con banner.
result: pass

### 10. Resolución N/N
expected: Banner navega a resolución, foto + selector de especie, guardar resuelve.
result: pass

### 11. Revertir Orden
expected: Diálogo de confirmación, posiciones se invierten.
result: pass

### 12. Finalizar SubGrupo con guarda N/N
expected: Error si hay N/N sin resolver, confirmación y chip naranja si no hay.
result: pass

### 13. SubGrupo finalizado es solo lectura
expected: Grilla deshabilitada, no se pueden agregar/eliminar árboles.
result: pass

### 14. Solo el creador puede editar
expected: Otro técnico ve el SubGrupo sin Finalizar ni opciones de edición.
result: issue
reported: "Se muestra sin la opción de finalizar, pero me permite entrar y editarla normalmente"
severity: major

## Summary

total: 14
passed: 12
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Todos los botones de especies deberían tener el mismo tamaño"
  status: failed
  reason: "User reported: Las últimas 2 especies ocupan el ancho de 2 casilleros"
  severity: cosmetic
  test: 6
  artifacts: []
  missing: []

- truth: "Otro técnico no puede editar SubGrupos que no creó"
  status: failed
  reason: "User reported: puede entrar y editar normalmente, solo falta botón Finalizar"
  severity: major
  test: 14
  artifacts: []
  missing: []
