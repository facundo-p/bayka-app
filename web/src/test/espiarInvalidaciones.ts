import { QueryClient } from '@tanstack/react-query';
import { onTestFinished, vi } from 'vitest';

/** Espía las invalidaciones de cualquier QueryClient del test, incluido el que
 *  crea un helper de render sin exponerlo. Se restaura al terminar el test. */
export function espiarInvalidaciones() {
  const espia = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
  onTestFinished(() => espia.mockRestore());
  return espia;
}
