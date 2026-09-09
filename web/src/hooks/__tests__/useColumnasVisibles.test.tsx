import { renderHook } from '@testing-library/react';
import { useColumnasVisibles } from '../useColumnasVisibles';
import { COLUMNAS_PLANTACIONES } from '../../screens/plantaciones/columnas';
import { COLUMNAS_ESPECIES } from '../../screens/especies/columnas';
import { columnasUsuarios } from '../../screens/usuarios/columnas';
import { ANCHO, restaurarAncho, simularAncho } from '../../test/simularAncho';
import type { TableColumn } from '../../components/Table';

interface Fila {
  id: string;
}

const COLUMNAS: Array<TableColumn<Fila>> = [
  { key: 'id', header: 'ID' },
  { key: 'fecha', header: 'Creada', fueraEnMovil: true },
  { key: 'gps', header: 'GPS', fueraEnMovil: true, fueraConPanel: true },
  { key: 'acciones', header: '' },
];

const claves = <T,>(columnas: Array<TableColumn<T>>) => columnas.map((c) => c.key);

afterEach(restaurarAncho);

describe('useColumnasVisibles', () => {
  it('en desktop no saca ninguna', () => {
    simularAncho(ANCHO.desktop);
    const { result } = renderHook(() => useColumnasVisibles(COLUMNAS));
    expect(claves(result.current)).toEqual(['id', 'fecha', 'gps', 'acciones']);
  });

  it('en móvil saca las secundarias', () => {
    simularAncho(ANCHO.movil);
    const { result } = renderHook(() => useColumnasVisibles(COLUMNAS));
    expect(claves(result.current)).toEqual(['id', 'acciones']);
  });

  it('con el panel abierto saca las que el panel repite', () => {
    simularAncho(ANCHO.desktop);
    const { result } = renderHook(() => useColumnasVisibles(COLUMNAS, true));
    expect(claves(result.current)).toEqual(['id', 'fecha', 'acciones']);
  });

  it('en móvil con el panel abierto saca las dos clases', () => {
    simularAncho(ANCHO.movil);
    const { result } = renderHook(() => useColumnasVisibles(COLUMNAS, true));
    expect(claves(result.current)).toEqual(['id', 'acciones']);
  });

  it('devuelve el mismo array si no hay nada que sacar', () => {
    simularAncho(ANCHO.desktop);
    const { result } = renderHook(() => useColumnasVisibles(COLUMNAS));
    expect(result.current).toBe(COLUMNAS);
  });
});

/*
 * Las dos reglas duras del ocultamiento: una tabla sin su columna de identidad
 * no se puede leer, y una sin la de acciones deja al usuario sin salida —que es
 * justo el defecto que se midió en Usuarios a 1024 antes de esta serie—.
 */
describe('lo que nunca se cae en móvil', () => {
  const usuarios = columnasUsuarios(
    () => {},
    'u1',
    2,
  );

  it.each([
    ['plantaciones', COLUMNAS_PLANTACIONES, 'lugar'],
    ['especies', COLUMNAS_ESPECIES, 'codigo'],
    ['usuarios', usuarios, 'usuario'],
  ])('%s conserva su columna de identidad', (_nombre, columnas, identidad) => {
    simularAncho(ANCHO.movil);
    const { result } = renderHook(() =>
      useColumnasVisibles(columnas as Array<TableColumn<unknown>>),
    );
    expect(claves(result.current)).toContain(identidad);
  });

  it('usuarios conserva la columna de acciones', () => {
    simularAncho(ANCHO.movil);
    const { result } = renderHook(() => useColumnasVisibles(usuarios));
    expect(claves(result.current)).toContain('acciones');
  });

  it('en móvil efectivamente saca columnas de las tres tablas', () => {
    simularAncho(ANCHO.movil);
    for (const columnas of [COLUMNAS_PLANTACIONES, COLUMNAS_ESPECIES, usuarios]) {
      const { result } = renderHook(() =>
        useColumnasVisibles(columnas as Array<TableColumn<unknown>>),
      );
      expect(result.current.length).toBeLessThan(columnas.length);
    }
  });
});
