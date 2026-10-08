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

const conflictoDeSync = (campo: string, mio: unknown, motivo: string | null) => ({
  conflicto: {
    entidadId: 't1', campo, grupoId: 'g1', plantacionId: 'p1', mio, servidor: null, detectadoEn: '2026-10-08T10:00:00',
  },
  arbol: ARBOL,
  grupo: GRUPO,
  especies: { mia: null, servidor: null },
  motivo,
});

let mockConflictosDeSync: unknown[] = [];
jest.mock('../../src/database/liveQuery', () => ({ useLiveData: (fetcher: () => unknown) => ({ data: fetcher() }) }));
jest.mock('../../src/queries/cambiosPorResolverQueries', () => ({
  getCambiosPorResolver: () => ({ lugar: 'Lote Norte', conflictos: CONFLICTOS }),
}));
jest.mock('../../src/services/ConflictosParaResolverService', () => ({
  conflictosParaResolver: () => mockConflictosDeSync,
  resolverConflictosDeSync: jest.fn(),
}));
jest.mock('../../src/hooks/useNetStatus', () => ({ useNetStatus: () => ({ isOnline: true, conexionConocida: true }) }));
jest.mock('../../src/repositories/PlantationRepository', () => ({ resolverCambios: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';
import { useResolverCambios } from '../../src/hooks/useResolverCambios';
import { resolverCambios } from '../../src/repositories/PlantationRepository';
import { resolverConflictosDeSync } from '../../src/services/ConflictosParaResolverService';

const mockResolver = resolverCambios as jest.Mock;
const mockResolverDeSync = resolverConflictosDeSync as jest.Mock;

describe('useResolverCambios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConflictosDeSync = [];
    mockResolverDeSync.mockResolvedValue(0);
  });

  it('guarda todas las elecciones juntas (sin tocar, el propio) y vuelve', async () => {
    mockResolver.mockResolvedValue(undefined);
    const { result } = renderHook(() => useResolverCambios('p1'));

    act(() => result.current.elegir('descripcion', 'web'));
    await act(() => result.current.guardar());

    expect(mockResolver).toHaveBeenCalledWith('p1', { objetivoArboles: 'mio', descripcion: 'web' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('si falla no se va de la pantalla y muestra el error', async () => {
    mockResolver.mockRejectedValue(new Error('sqlite'));
    const { result } = renderHook(() => useResolverCambios('p1'));

    await act(() => result.current.guardar());

    expect(result.current.error).toBe('No se pudo guardar la elección. Probá de nuevo.');
    expect(result.current.guardando).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
  });

  describe('conflictos de sincronización (#804)', () => {
    const PUNTO = { latitude: -27.3605, longitude: -55.8975, gpsAccuracy: 4, gpsCapturedAt: '2026-10-08T10:40:00' };

    it('varios del mismo árbol van en una sección; arranca lo propio salvo que no se pueda conservar', () => {
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null), conflictoDeSync('especie', 'sp-eg', 'conflicto_sin_valor')];
      const { result } = renderHook(() => useResolverCambios('p1'));

      expect(result.current.cantidad).toBe(4);
      expect(result.current.secciones).toHaveLength(1);
      expect(result.current.secciones[0].titulo).toBe('Árbol L1EG3');
      expect(result.current.secciones[0].conflictos.map((t) => t.eleccion)).toEqual(['mio', 'web']);
    });

    it('guarda cada elección: lo que el usuario cambió y, sin motivo, lo propio', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockConflictosDeSync = [
        conflictoDeSync('gps', PUNTO, null),
        conflictoDeSync('foto', 'file:///mia.jpg', null),
        conflictoDeSync('especie', 'sp-eg', 'plantacion_no_editable'),
      ];
      const { result } = renderHook(() => useResolverCambios('p1'));
      const gps = result.current.secciones[0].conflictos[0];

      act(() => result.current.elegirEnSync(gps.clave, 'web'));
      await act(() => result.current.guardar());

      expect(mockResolverDeSync).toHaveBeenCalledWith([
        { entidadId: 't1', campo: 'gps', conservar: false },
        { entidadId: 't1', campo: 'foto', conservar: true },
        { entidadId: 't1', campo: 'especie', conservar: false },
      ]);
      expect(mockBack).toHaveBeenCalled();
    });

    it('si alguna no se pudo aplicar, se queda y lo avisa', async () => {
      mockResolver.mockResolvedValue(undefined);
      mockResolverDeSync.mockResolvedValue(1);
      mockConflictosDeSync = [conflictoDeSync('gps', PUNTO, null)];
      const { result } = renderHook(() => useResolverCambios('p1'));

      await act(() => result.current.guardar());

      expect(result.current.error).toBe('Una elección no se pudo guardar y quedó pendiente. Revisá el motivo y probá de nuevo.');
      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
