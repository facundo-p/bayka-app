import { contarPorEstado } from '../../src/utils/conteoPorEstado';

describe('contarPorEstado', () => {
  test('cuenta activas y finalizadas', () => {
    const items = [{ estado: 'activa' }, { estado: 'finalizada' }, { estado: 'activa' }];
    expect(contarPorEstado(items)).toEqual({ activa: 2, finalizada: 1 });
  });

  test('ignora estados fuera del filtro y estados ausentes', () => {
    const items = [{ estado: 'sincronizada' }, { estado: null }, {}];
    expect(contarPorEstado(items)).toEqual({ activa: 0, finalizada: 0 });
  });

  test('lista ausente cuenta cero', () => {
    expect(contarPorEstado(undefined)).toEqual({ activa: 0, finalizada: 0 });
  });
});
