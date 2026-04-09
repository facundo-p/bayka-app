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

### E2E tests (Maestro)

Requiere un emulador/dispositivo con la app corriendo:

```bash
maestro test mobile/.maestro/flows/
```

## CI/CD

- **Push a cualquier branch:** lint + unit tests + integration tests (`.github/workflows/ci.yml`)
- **PR a main:** E2E con Maestro en macOS (`.github/workflows/e2e.yml`)
