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

## Releases

Versionado por app (`web-vX.Y.Z` / `mobile-vX.Y.Z`), novedades en `CHANGELOG.md`.
El pase a producción se arma con el skill `/deploy`
(`.claude/skills/deploy/SKILL.md`) y lo mergea Facu a mano.
