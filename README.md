# bayka-app
App to manage tree plantations

## Setup

```bash
cd mobile
npm install
npx expo start
```

## Tests

Todos los comandos se ejecutan desde `mobile/`.

### Unit tests

```bash
npx jest --no-coverage
```

### Integration tests

Usan SQLite en memoria (better-sqlite3) en lugar de mocks:

```bash
npx jest --config jest.integration.config.js --no-coverage
```

### Correr un test específico

```bash
# Por nombre de archivo
npx jest --no-coverage --testPathPattern="useAuth"

# Integration específico
npx jest --config jest.integration.config.js --no-coverage --testPathPattern="offlineAuthCycle"
```

### Lint

```bash
npx expo lint
```

### E2E tests (Maestro)

Requiere un emulador/dispositivo con la app corriendo:

```bash
maestro test mobile/.maestro/flows/
```

## CI/CD

- **Push a cualquier branch:** typecheck + unit tests + integration tests de
  `mobile/` (`.github/workflows/ci.yml`; corre también en PRs a `staging` y `main`)
- **PR que toca `web/`:** typecheck + lint + tests de `web/`
  (`.github/workflows/web-ci.yml`)
- **Merge a `main`:** tags `web-vX.Y.Z` / `mobile-vX.Y.Z` + GitHub Releases con
  notas del `CHANGELOG.md` (`.github/workflows/release-tags.yml`)
- **E2E (Maestro):** deshabilitado; solo manual vía `workflow_dispatch`
  (`.github/workflows/e2e.yml`)

## APK Android

Dos variantes, instalables en paralelo en el mismo teléfono:

| | `prod` | `test` |
|---|---|---|
| Nombre | Bayka App | Bayka TEST |
| applicationId | `com.bayka.app` | `com.bayka.app.test` |
| Backend | Supabase de producción | Supabase de staging |
| Canal de updates | `production` | `test` |
| Artefacto | `mobile/build-output.apk` | `mobile/build-output-test.apk` |

### Requisitos

- Android SDK (`ANDROID_HOME`), Java 17 y Node LTS par (v20/v22 — los majors
  impares rompen el build).
- `.env` en la raíz con `EAS_PROJECT_ID`. Sin eso el APK sale sin servidor de
  updates y no recibe ningún OTA; el script corta antes de compilar.
- `mobile/.env.staging` con las credenciales de Supabase staging, solo para la
  variante `test`.
- Sesión de Expo para publicar updates: `npx eas-cli whoami` (si no, `npx eas-cli login`).

### Generar e instalar un APK

```bash
git checkout staging && git pull origin staging   # main para el APK de producción
cd mobile
scripts/build-apk.sh test                         # o: prod
adb install -r build-output-test.apk
```

El script regenera el proyecto nativo, compila (solo arm64 por defecto; `ABIS=all`
para todas las ABIs) y verifica el artefacto. Al terminar imprime package, label y
**canal de updates**: si el canal no es el de la variante, ese APK no va a recibir
ningún OTA.

Hace falta compilar un APK nuevo cuando cambia algo **nativo**: dependencias con
código nativo, plugins de config, permisos, íconos o el número de versión. Los
cambios de JS/TS y assets no lo necesitan.

Android solo deja instalar encima si la firma coincide. Entre builds locales
`adb install -r` conserva los datos de la app; cambiar el método de firma obliga a
desinstalar primero, y eso borra la base local (se pierde lo que no esté sincronizado).

### Actualizar sin reinstalar (OTA)

Los cambios de JS/TS y assets se publican con EAS Update y llegan solos a los
dispositivos:

```bash
cd mobile
npx eas-cli channel:list                  # el canal tiene que existir
npx eas-cli channel:create test           # solo la primera vez

APP_VARIANT=test npx eas-cli update --channel test --message "qué cambió"
```

- **`APP_VARIANT=test` es obligatorio para el canal `test`**: sin esa variable el
  update sale apuntando al Supabase de producción y sin el banner de entorno de
  pruebas. Para `production`, sin la variable.
- El update solo llega a los APK que tienen ese canal grabado y la misma
  `expo.version` de `mobile/app.json`. Un bump de versión deja afuera a los
  dispositivos viejos hasta que instalen el APK nuevo.
- El teléfono lo descarga en segundo plano al abrir la app y lo aplica en el
  **siguiente** arranque en frío: cerrar la app del todo y volver a abrirla.
- En la variante TEST se confirma en la franja roja, que pasa a mostrar el commit
  del código publicado.

El OTA es solo para hotfixes dentro de una versión ya publicada. Un release con
cambios de mobile lleva APK nuevo con `versionCode` +1.

## Releases

Versionado por app (`web-vX.Y.Z` / `mobile-vX.Y.Z`), novedades en `CHANGELOG.md`.
El pase a producción se arma con el skill `/deploy`
(`.claude/skills/deploy/SKILL.md`) y lo mergea Facu a mano.
