// This file runs before any test modules are loaded (setupFiles)
// SDK 52 uses Babel, so no winter runtime workarounds needed.

// Mock structuredClone if not available in test environment
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
