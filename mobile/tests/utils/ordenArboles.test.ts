// Tests del orden de vista del listado de árboles.
import { alternarOrden, ordenarArbolesParaVista } from '../../src/utils/ordenArboles';

describe('ordenarArbolesParaVista', () => {
  const arboles = [{ posicion: 1 }, { posicion: 2 }, { posicion: 3 }];

  it('ascendente conserva el orden', () => {
    expect(ordenarArbolesParaVista(arboles, 'asc').map((a) => a.posicion)).toEqual([1, 2, 3]);
  });

  it('descendente invierte sin mutar el original', () => {
    expect(ordenarArbolesParaVista(arboles, 'desc').map((a) => a.posicion)).toEqual([3, 2, 1]);
    expect(arboles.map((a) => a.posicion)).toEqual([1, 2, 3]);
  });

  it('lista vacía devuelve vacía', () => {
    expect(ordenarArbolesParaVista([], 'desc')).toEqual([]);
  });
});

describe('alternarOrden', () => {
  it('alterna entre asc y desc', () => {
    expect(alternarOrden('asc')).toBe('desc');
    expect(alternarOrden('desc')).toBe('asc');
  });
});
