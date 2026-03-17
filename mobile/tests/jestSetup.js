// This file runs before any test modules are loaded (setupFiles)
// Prevent expo winter runtime from triggering import.meta related errors

// Mock __ExpoImportMetaRegistry before the lazy getter can be triggered
Object.defineProperty(globalThis, '__ExpoImportMetaRegistry', {
  value: { url: null },
  configurable: true,
  writable: true,
  enumerable: false,
});

// Mock structuredClone if not available (prevent expo winter runtime lazy load)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
