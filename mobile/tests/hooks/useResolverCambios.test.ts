const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const CONFLICTOS = [
  { campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000, editadoPor: null, editadoEn: null, mioEn: null },
  { campo: 'descripcion', mio: 'Mía', web: 'Web', anterior: null, editadoPor: null, editadoEn: null, mioEn: null },
];

const ARBOL = {
  id: 't1', subId: 'L1EG3', posicion: 3, especieId: 'sp-pt',
  latitude: -27.36, longitude: -55.89, gpsAccuracy: 12, gpsCapturedAt: '2026-10-07T18:03:00Z', fotoUrl: null,
};
const GRUPO = { id: 'g1', parcelaId: 'x1', codigo: 'G12', nombre: 'Línea norte', tipo: 'linea', estado: 'finalizada' };

const DETECTADO = '2026-10-08T10:00:00';

const conflictoDeSync = (campo: string, mio: unknown, motivo: string | null, detectadoEn = DETECTADO) => ({
  conflicto: {
    entidadId: 't1', campo, grupoId: 'g1', plantacionId: 'p1', mio, servidor: null, detectadoEn,
  },
  arbol: ARBOL,
  grupo: GRUPO,
  especies: { mia: null, servidor: null },
  motivo,
});

let mockConflictosDeSync: unknown[] = [];
// Como el real: carga al montar, y `refresh` o un aviso de cambio vuelven a pedir.
const mockAvisos = new Set<() => void>();
jest.mock('../../src/database/liveQuery', () => {
  const { useCallback, useEffect, useState } = require('react');
  return {
    useLiveData: (fetcher: () => unknown) => {
      const [data, setData] = useState(undefined);
      const refresh = useCallback(() => {
        void Promise.resolve(fetcher()).then(setData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      useEffect(() => {
        refresh();
        mockAvisos.add(refresh);
        return () => {
          mockAvisos.delete(refresh);
        };
      }, [refresh]);
      return { data, refresh };
    },
  };
});
const avisarCambio = () => mockAvisos.forEach((refrescar) => refrescar());
jest.mock('../../src/queries/cambiosPorResolverQueries', () => ({
  getCambiosPorResolver: () => ({ lugar: 'Lote Norte', conflictos: CONFLICTOS }),
}));
jest.mock('../../src/services/ConflictosParaResolverService', () => ({
  conflictosParaResolver: jest.fn(() => mockConflictosDeSync),
  resolverConflictosDeSync: jest.fn(),
}));
let mockConexion = { isOnline: true, conexionConocida: true };
jest.mock('../../src/hooks/useNetStatus', () => ({ useNetStatus: () => mockConexion }));
jest.mock('../../src/repositories/PlantationRepository', () => ({ resolverCambios: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useResolverCambios } from '../../src/hooks/useResolverCambios';
import { resolverCambios } from '../../src/repositories/PlantationRepository';
import { conflictosParaResolver, resolverConflictosDeSync } from '../../src/services/ConflictosParaResolverService';

const mockResolver = resolverCambios as jest.Mock;
const mockResolverDeSync = resolverConflictosDeSync as jest.Mock;
const mockCargarConflictos = conflictosParaResolver as jest.Mock;

async function montar() {
  const hook = renderHook(() => useResolverCambios('p1'));
  await waitFor(() => expect(hook.result.current.cargando).toBe(false));
  return hook;
}

describe('useResolverCambios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConflictosDeSync = [];
    mockConexion = { isOnline: true, conexionConocida: true };
    mockResolverDeSync.mockResolvedValue([]);
  });

  it('guarda todas las elecciones juntas (sin tocar, el propio) y vuelve', async () => {
    mockResolver.mockResolvedValue(undefined);
    const { result } = await montar();

    act(() => result.current.elegir('descripcion', 'web'));
    await act(() => result.current.guardar());

    expect(mockResolver).toHaveBeenCalledWith('p1', { objetivoArboles: 'mio', descripcion: 'web' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('si falla no se va de la pantalla y muestra el error', async () => {
    mockResolver.mockRejectedValue(new Error('sqlite'));
    const { result } = await montar();

    await act(() => result.current.guardar());

    expect(result.current.error).toBe('No se pudo guardar la elección. Probá de nuevo.');
    expect(result.current.guardando).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
  });

  describe('conflictos de sincronización (#804)', () => {
    const PUNTO = { latitude: -27.3605, longitude: -55.8975, gpsAccuracy: 4, gpsCapturedAt: '2026-10-08T10:40:00' };

    it('varios del mismo árbol van en una sección; arranca lo propio salvo que no se pueda conservar', async () => {
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null), conflictoDeSync('especie', 'sp-eg', 'conflicto_sin_valor')];
      const { result } = await montar();

      expect(result.current.cantidad).toBe(4);
      expect(result.current.secciones).toHaveLength(1);
      expect(result.current.secciones[0].titulo).toBe('Árbol L1EG3');
      expect(result.current.secciones[0].conflictos.map((t) => [t.vista.titulo, t.eleccion])).toEqual([
        ['Especie', 'web'], ['Ubicación GPS', 'mio'],
      ]);
    });

    it('guarda cada elección: lo que el usuario cambió y, sin motivo, lo propio', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockConflictosDeSync = [
        conflictoDeSync('gps', PUNTO, null),
        conflictoDeSync('foto', 'file:///mia.jpg', null),
        conflictoDeSync('especie', 'sp-eg', 'plantacion_no_editable'),
      ];
      const { result } = await montar();
      const gps = result.current.secciones[0].conflictos.find((t) => t.vista.titulo === 'Ubicación GPS')!;

      act(() => result.current.elegirEnSync(gps.clave, 'web'));
      await act(() => result.current.guardar());

      expect(mockResolverDeSync).toHaveBeenCalledWith([
        { entidadId: 't1', campo: 'gps', detectadoEn: DETECTADO, conservar: false },
        { entidadId: 't1', campo: 'foto', detectadoEn: DETECTADO, conservar: true },
        { entidadId: 't1', campo: 'especie', detectadoEn: DETECTADO, conservar: false },
      ]);
      expect(mockBack).toHaveBeenCalled();
    });

    it('si alguna no se pudo aplicar, se queda, lo avisa y marca la tarjeta', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockResolverDeSync.mockResolvedValue([{ entidadId: 't1', campo: 'gps', falla: 'error' }]);
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null)];
      const { result } = await montar();

      await act(() => result.current.guardar());

      expect(result.current.error).toBe('Una elección no se pudo guardar y quedó pendiente. Su tarjeta dice por qué.');
      expect(result.current.secciones[0].conflictos[0].vista.aviso).toBe('No se pudo guardar esta elección. Probá de nuevo.');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('si el servidor cambió el dato mientras se elegía, la elección vuelve a empezar y la tarjeta lo dice', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null)];
      const { result } = await montar();
      act(() => result.current.elegirEnSync(result.current.secciones[0].conflictos[0].clave, 'web'));
      mockResolverDeSync.mockImplementation(async () => {
        mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null, '2026-10-08T11:00:00')];
        return [{ entidadId: 't1', campo: 'gps', falla: 'cambio' }];
      });

      await act(() => result.current.guardar());

      await waitFor(() => expect(result.current.secciones[0].conflictos[0].clave).toMatch(/11:00:00$/));
      const tarjeta = result.current.secciones[0].conflictos[0];
      expect(tarjeta.eleccion).toBe('mio');
      expect(tarjeta.vista.aviso).toMatch(/^Cambió de nuevo/);
    });

    it('un segundo toque mientras guarda no hace nada', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null)];
      const { result } = await montar();

      await act(async () => {
        await Promise.all([result.current.guardar(), result.current.guardar()]);
      });

      expect(mockResolver).toHaveBeenCalledTimes(1);
      expect(mockResolverDeSync).toHaveBeenCalledTimes(1);
    });

    it('mientras guarda no recarga la lista con cada elección aplicada; al terminar, sí', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockResolverDeSync.mockResolvedValue([{ entidadId: 't1', campo: 'gps', falla: 'error' }]);
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null)];
      const { result } = await montar();
      const cargasAntes = mockCargarConflictos.mock.calls.length;
      mockResolverDeSync.mockImplementationOnce(async () => {
        avisarCambio();
        avisarCambio();
        return [{ entidadId: 't1', campo: 'gps', falla: 'error' }];
      });

      await act(() => result.current.guardar());

      expect(mockCargarConflictos.mock.calls.length).toBe(cargasAntes + 1);
    });

    it('sin saber todavía si hay conexión, intenta mostrar la foto del servidor', async () => {
      mockConexion = { isOnline: false, conexionConocida: false };
      mockConflictosDeSync = [{ ...conflictoDeSync('foto', 'file:///mia.jpg', null), arbol: { ...ARBOL, fotoUrl: 'plantations/p/t1.jpg' } }];
      const { result } = await montar();

      expect(result.current.secciones[0].conflictos[0].vista.otro.foto?.enLinea).toBe(true);
    });
  });
});
