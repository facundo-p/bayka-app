# shared/

Lógica que comparten la web y la app mobile, escrita una sola vez (#713). Cada app
la importa con una ruta relativa (`../../../shared/codigoPlantacion`).

## Reglas

- **Solo funciones puras en TypeScript**: sin React, sin base, sin red, sin
  dependencias de npm.
- **Nada de imports desde `web/` ni `mobile/`.** Si algo necesita una de las dos
  apps, no va acá.
- **Un cambio acá es un cambio de las dos apps**: `/deploy` lo cuenta para web y
  para mobile, así que bumpea las dos versiones y exige APK nueva.
- **Las APKs viejas conviven semanas con la versión nueva.** Compartir el código
  no evita esa convivencia: un cambio de reglas tiene que seguir siendo
  compatible con lo que suben las versiones anteriores.
- **Se migra de a un módulo**: el resto de la lógica duplicada pasa acá cuando
  se lo toca por otro motivo. No hay migración masiva.

## Tests y CI

Los tests (`*.test.ts`, con los globals de vitest) corren en el vitest de web, y
el lint de web también cubre esta carpeta. El CI mobile los ejercita a través de
sus propios tests. Metro la ve por `watchFolders` (`mobile/metro.config.js`) y
jest resuelve sus dependencias de babel desde `mobile/node_modules`
(`modulePaths` en `mobile/jest.config.js`).
