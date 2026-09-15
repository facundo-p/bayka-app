// Selección de árbol en la tira de la botonera (#459).

import { act, renderHook } from '@testing-library/react-native';

import {
  resolveSelectedTreeId,
  useTreeSelection,
  type TreeSelection,
} from '../../src/hooks/useTreeSelection';

const tree = (id: string) => ({ id });
const A = tree('a');
const B = tree('b');
const C = tree('c');
const D = tree('d');

function selectionOf(id: string, known: { id: string }[]): TreeSelection {
  return { id, knownIds: new Set(known.map((t) => t.id)) };
}

describe('resolveSelectedTreeId', () => {
  it('grupo vacío: sin selección', () => {
    expect(resolveSelectedTreeId([], null)).toBeNull();
  });

  it('sin elegir: el último', () => {
    expect(resolveSelectedTreeId([A, B, C], null)).toBe('c');
  });

  it('elegido a mano: se mantiene', () => {
    expect(resolveSelectedTreeId([A, B, C], selectionOf('b', [A, B, C]))).toBe('b');
  });

  it('borrado el elegido: pasa al último', () => {
    expect(resolveSelectedTreeId([A, C], selectionOf('b', [A, B, C]))).toBe('c');
  });

  it('alta nueva: la selección salta al nuevo', () => {
    expect(resolveSelectedTreeId([A, B, C, D], selectionOf('b', [A, B, C]))).toBe('d');
  });

  it('invertir el orden conserva la selección por id', () => {
    expect(resolveSelectedTreeId([C, B, A], selectionOf('b', [A, B, C]))).toBe('b');
  });

  it('borrar otro árbol no mueve la selección', () => {
    expect(resolveSelectedTreeId([B, C], selectionOf('b', [A, B, C]))).toBe('b');
  });
});

describe('useTreeSelection', () => {
  it('tocar un chip lo selecciona', () => {
    const { result } = renderHook(({ trees }) => useTreeSelection(trees), {
      initialProps: { trees: [A, B, C] },
    });
    expect(result.current.selectedTree).toBe(C);

    act(() => result.current.select('a'));

    expect(result.current.selectedTree).toBe(A);
  });

  it('deshacer el alta no resucita la selección anterior: queda el último', () => {
    const { result, rerender } = renderHook(({ trees }) => useTreeSelection(trees), {
      initialProps: { trees: [A, B, C] },
    });
    act(() => result.current.select('a'));

    rerender({ trees: [A, B, C, D] });
    expect(result.current.selectedTree).toBe(D);

    rerender({ trees: [A, B, C] });
    expect(result.current.selectedTree).toBe(C);
  });

  it('borrar el único árbol vuelve al estado vacío', () => {
    const { result, rerender } = renderHook(({ trees }) => useTreeSelection(trees), {
      initialProps: { trees: [A] },
    });
    rerender({ trees: [] as { id: string }[] });
    expect(result.current.selectedTree).toBeNull();
  });
});
