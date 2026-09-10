# Novedades de Bayka

Qué trae cada actualización de Bayka, contado para quienes usan la app. Este es
el changelog para compartir con usuarios y clientes: sin referencias internas ni
detalles técnicos (esos viven en [CHANGELOG.md](CHANGELOG.md)).

> El formato de abajo es **contrato**: los `## ` y los bullets
> `- **Titular.** Detalle` los parsea la web para la pantalla `/novedades`
> (`web/src/lib/parsearNovedades.ts`), igual que los headers de `CHANGELOG.md`
> son anclas del workflow de tags. Cambiar el formato rompe esa pantalla.
>
> Entre releases, staging tiene arriba una sección `## En pruebas · …` que
> mantiene el skill `/novedades`: cada bullet lleva su traza oculta
> `<!-- #N -->` y los pasos para probarlo como sub-bullets, y la sección, una
> marca `<!-- sincronizado-hasta: … -->`. La web la muestra solo en staging;
> `/deploy` la convierte en la entrada de la versión.

## Web 1.1.0 · 21 de agosto de 2026

- **Mostrá u ocultá tu contraseña.** El inicio de sesión y los formularios de
  contraseña ahora tienen un botón con forma de ojo para ver lo que estás
  escribiendo y evitar errores de tipeo.

## Web 1.0.0 · Mobile 1.0.0 · 20 de agosto de 2026

- Primera versión numerada de Bayka: la gestión web para administrar
  plantaciones y la app Android para el trabajo en campo.
