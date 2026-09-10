import { renderHook } from '@testing-library/react';
import { useColumnasVisibles } from '../useColumnasVisibles';
import { COLUMNAS_PLANTACIONES } from '../../screens/plantaciones/columnas';
import { COLUMNAS_ESPECIES } from '../../screens/especies/columnas';
import { columnasUsuarios } from '../../screens/usuarios/columnas';
import { COLUMNAS_GRUPOS, COLUMNAS_PARCELAS, columnasArboles } from '../../screens/datos/columnas';
import { ANCHO, simularAncho } from '../../test/simularAncho';
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
  const arboles = columnasArboles(new Map(), new Map());

  // Las seis tablas de la app, no las que resultaron fáciles de importar.
  it.each([
    ['plantaciones', COLUMNAS_PLANTACIONES, 'lugar'],
    ['especies', COLUMNAS_ESPECIES, 'codigo'],
    ['usuarios', usuarios, 'usuario'],
    ['parcelas', COLUMNAS_PARCELAS, 'nombre'],
    ['grupos', COLUMNAS_GRUPOS, 'codigo'],
    ['arboles', arboles, 'subId'],
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

  it('en móvil efectivamente saca columnas de cada tabla', () => {
    simularAncho(ANCHO.movil);
    for (const columnas of [
      COLUMNAS_PLANTACIONES,
      COLUMNAS_ESPECIES,
      usuarios,
      COLUMNAS_PARCELAS,
      COLUMNAS_GRUPOS,
      arboles,
    ]) {
      const { result } = renderHook(() =>
        useColumnasVisibles(columnas as Array<TableColumn<unknown>>),
      );
      expect(result.current.length).toBeLessThan(columnas.length);
    }
  });
});
