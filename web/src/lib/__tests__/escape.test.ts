import { vi } from 'vitest';
import { cerrarSoloEstaCapa } from '../escape';

function evento(key: string) {
  return { key, stopPropagation: vi.fn() };
}

test('Escape cierra la capa y no sigue hacia lo de atrás', () => {
  const cerrar = vi.fn();
  const escape = evento('Escape');

  expect(cerrarSoloEstaCapa(escape, cerrar)).toBe(true);
  expect(cerrar).toHaveBeenCalledTimes(1);
  expect(escape.stopPropagation).toHaveBeenCalledTimes(1);
});

test('otra tecla no cierra ni se frena: sigue su curso', () => {
  const cerrar = vi.fn();
  const tab = evento('Tab');

  expect(cerrarSoloEstaCapa(tab, cerrar)).toBe(false);
  expect(cerrar).not.toHaveBeenCalled();
  expect(tab.stopPropagation).not.toHaveBeenCalled();
});
