# Changelog

Novedades de Bayka por release a producción. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-AR/1.1.0/), adaptado: web y
mobile llevan versiones independientes (tags `web-vX.Y.Z` / `mobile-vX.Y.Z`),
agrupadas por release (fecha del pase a `main`).

Las notas de cada versión las extrae automáticamente
`.github/workflows/release-tags.yml`: los headers `## ` (release) y `### `
(app/versión, formato exacto `### Web X.Y.Z` / `### Mobile X.Y.Z (versionCode N)`)
son las anclas de ese script — no cambiar su formato sin actualizar el workflow.
La entrada nueva de cada release la escribe el skill `/deploy`.

## 2026-08-20 · web 1.0.0 · mobile 1.0.0

Baseline del sistema de versionado (#273): ambas apps arrancan en 1.0.0 sobre
el estado de producción vigente.

### Web 1.0.0

- Versión inicial versionada: gestión web (Vite + React) en Cloudflare Pages.

### Mobile 1.0.0 (versionCode 1)

- Versión inicial versionada: app Android (Expo), distribución por APK local.
