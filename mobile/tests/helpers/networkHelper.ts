// Network state helpers for integration tests
// Allows simulating offline/online state changes

let _isOffline = false;

export function setOffline(): void {
  _isOffline = true;
}

export function setOnline(): void {
  _isOffline = false;
}

export function isOffline(): boolean {
  return _isOffline;
}
