// Tests for useTreeRegistration hook

jest.mock('expo-router', () => ({
  useRouter: jest.fn().mockReturnValue({ back: jest.fn() }),
}));

jest.mock('../../src/repositories/TreeRepository', () => ({
  insertTree: jest.fn(),
  deleteLastTree: jest.fn(),
  reverseTreeOrder: jest.fn(),
  updateTreePhoto: jest.fn(),
  deleteTreeAndRecalculate: jest.fn(),
}));

jest.mock('../../src/repositories/GroupRepository', () => ({
  finalizeGroup: jest.fn(),
  canEdit: jest.fn(),
  deleteGroup: jest.fn(),
  reactivateGroup: jest.fn(),
}));

jest.mock('../../src/hooks/useTrees', () => ({
  useTrees: jest.fn().mockReturnValue({
    allTrees: [],
    lastThree: [],
    totalCount: 0,
    unresolvedNN: 0,
  }),
}));

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn(),
  notifyDataChanged: jest.fn(),
}));

jest.mock('../../src/queries/plantationDetailQueries', () => ({
  getGroupById: jest.fn(),
}));

const { insertTree, deleteLastTree } = require('../../src/repositories/TreeRepository');
const { finalizeGroup, canEdit } = require('../../src/repositories/GroupRepository');
const { useLiveData } = require('../../src/database/liveQuery');
const { useTrees } = require('../../src/hooks/useTrees');

import { renderHook, act } from '@testing-library/react-native';
import { useTreeRegistration } from '../../src/hooks/useTreeRegistration';

const pickPhoto = jest.fn<Promise<string | null>, [unknown?]>();

const DEFAULT_PARAMS = {
  grupoId: 'sg-1',
  plantacionId: 'plant-1',
  grupoCodigo: 'L1',
  userId: 'user-1',
  pickPhoto,
};

const FOTO = 'file:///foto.jpg';

const mockGroup = {
  id: 'sg-1',
  codigo: 'L1',
  tipo: 'linea',
  estado: 'activa',
  usuarioCreador: 'user-1',
};

/**
 * useLiveData recibe una arrow que llama a la query; se la distingue por el nombre
 * de la query en su fuente. Sin config de captura, el hook cae a los defaults.
 */
function mockLiveQueries({ group = mockGroup, captureConfig = null }: {
  group?: typeof mockGroup;
  captureConfig?: { gpsFrequency: number; gpsRequired: boolean; photoAllTrees: boolean } | null;
} = {}) {
  (useLiveData as jest.Mock).mockImplementation((queryFn: () => unknown) => {
    const fuente = String(queryFn);
    if (fuente.includes('getPlantationCaptureConfig')) return { data: captureConfig };
    if (fuente.includes('getGroupById')) return { data: [group] };
    return { data: undefined };
  });
}

describe('useTreeRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockLiveQueries();
    pickPhoto.mockResolvedValue(FOTO);
    (canEdit as jest.Mock).mockReturnValue(true);
    (useTrees as jest.Mock).mockReturnValue({
      allTrees: [],
      lastThree: [],
      totalCount: 0,
      unresolvedNN: 0,
    });
    (insertTree as jest.Mock).mockResolvedValue({ id: 'tree-new', posicion: 1, subId: 'L1ANC1' });
    (deleteLastTree as jest.Mock).mockResolvedValue({ deleted: true });
    (finalizeGroup as jest.Mock).mockResolvedValue({ success: true });
  });

  describe('registerTree', () => {
    it('calls insertTree with correct params when subgroup is active and user is owner', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).toHaveBeenCalledWith({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: 'esp-1',
        especieCodigo: 'ANC',
        fotoUrl: null,
        userId: 'user-1',
      });
    });

    it('does NOT call insertTree when subgroup is read-only (finalizada)', async () => {
      mockLiveQueries({ group: { ...mockGroup, estado: 'finalizada' } });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).not.toHaveBeenCalled();
    });

    it('does NOT call insertTree when userId is empty', async () => {
      const { result } = renderHook(() => useTreeRegistration({
        ...DEFAULT_PARAMS,
        userId: '',
      }));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).not.toHaveBeenCalled();
    });
  });

  // #439: con "foto en todos los botones" la botonera pasa por la misma política que N/N.
  describe('registerTree · foto en todos los botones', () => {
    const CONFIG_FOTO = { gpsFrequency: 10, gpsRequired: true, photoAllTrees: true };

    it('con el flag apagado no abre el selector de foto', async () => {
      mockLiveQueries({ captureConfig: { ...CONFIG_FOTO, photoAllTrees: false } });
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(result.current.photoCaptureAllTrees).toBe(false);
      expect(pickPhoto).not.toHaveBeenCalled();
      expect(insertTree).toHaveBeenCalledWith(expect.objectContaining({ especieId: 'esp-1', fotoUrl: null }));
    });

    it('con el flag prendido pide foto y la guarda en el árbol', async () => {
      mockLiveQueries({ captureConfig: CONFIG_FOTO });
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(result.current.photoCaptureAllTrees).toBe(true);
      expect(pickPhoto).toHaveBeenCalledWith({ optional: false });
      expect(insertTree).toHaveBeenCalledWith(expect.objectContaining({ especieId: 'esp-1', fotoUrl: FOTO }));
    });

    it('con el flag prendido y sin foto no registra (la foto es obligatoria)', async () => {
      mockLiveQueries({ captureConfig: CONFIG_FOTO });
      pickPhoto.mockResolvedValue(null);
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(insertTree).not.toHaveBeenCalled();
    });

    it('en solo lectura no abre el selector aunque el flag esté prendido', async () => {
      mockLiveQueries({ group: { ...mockGroup, estado: 'finalizada' }, captureConfig: CONFIG_FOTO });
      (canEdit as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(pickPhoto).not.toHaveBeenCalled();
      expect(insertTree).not.toHaveBeenCalled();
    });
  });

  describe('registerNN', () => {
    it('pide foto obligatoria y registra sin especie con código NN', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerNN();
      });

      expect(pickPhoto).toHaveBeenCalledWith({ optional: false });
      expect(insertTree).toHaveBeenCalledWith({
        grupoId: 'sg-1',
        grupoCodigo: 'L1',
        especieId: null,
        especieCodigo: 'NN',
        fotoUrl: FOTO,
        userId: 'user-1',
      });
    });

    it('sin foto no registra', async () => {
      pickPhoto.mockResolvedValue(null);
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.registerNN();
      });

      expect(insertTree).not.toHaveBeenCalled();
    });

    it('un throw del insert notifica el mensaje real vía onError', async () => {
      (insertTree as jest.Mock).mockRejectedValue(new Error('Grupo sg-1 sin parcela: dato inválido'));
      const onError = jest.fn();
      const { result } = renderHook(() => useTreeRegistration({ ...DEFAULT_PARAMS, onError }));

      await act(async () => {
        await result.current.registerNN();
      });

      expect(onError).toHaveBeenCalledWith('Grupo sg-1 sin parcela: dato inválido');
    });
  });

  describe('undoLast', () => {
    it('calls deleteLastTree with grupoId when subgroup is active', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.undoLast();
      });

      expect(deleteLastTree).toHaveBeenCalledWith('sg-1');
    });

    it('does NOT call deleteLastTree when subgroup is read-only', async () => {
      mockLiveQueries({ group: { ...mockGroup, estado: 'sincronizada' } });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.undoLast();
      });

      expect(deleteLastTree).not.toHaveBeenCalled();
    });
  });

  describe('executeFinalize', () => {
    it('calls finalizeGroup with grupoId', async () => {
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.executeFinalize();
      });

      expect(finalizeGroup).toHaveBeenCalledWith('sg-1');
    });

    it('navigates back after successful finalization', async () => {
      const mockBack = jest.fn();
      const { useRouter } = require('expo-router');
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      await act(async () => {
        await result.current.executeFinalize();
      });

      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  // #90: los writers eran fire-and-forget — un throw (p.ej. "grupo sin parcela")
  // se perdía como unhandled rejection sin aviso; ahora se surfacea vía onError.
  describe('surface de errores de escritura (onError, #90)', () => {
    it('registerTree: un throw del insert notifica el mensaje real y no revienta', async () => {
      (insertTree as jest.Mock).mockRejectedValue(
        new Error('Grupo sg-1 sin parcela: dato inválido'),
      );
      const onError = jest.fn();
      const { result } = renderHook(() => useTreeRegistration({ ...DEFAULT_PARAMS, onError }));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(onError).toHaveBeenCalledWith('Grupo sg-1 sin parcela: dato inválido');
    });

    it('registerTree: error sin mensaje usa el fallback', async () => {
      (insertTree as jest.Mock).mockRejectedValue('crash raro');
      const onError = jest.fn();
      const { result } = renderHook(() => useTreeRegistration({ ...DEFAULT_PARAMS, onError }));

      await act(async () => {
        await result.current.registerTree('esp-1', 'ANC');
      });

      expect(onError).toHaveBeenCalledWith('No se pudo registrar el árbol.');
    });

    it('undoLast: un throw del delete notifica en vez de perderse', async () => {
      (deleteLastTree as jest.Mock).mockRejectedValue(new Error('disk I/O error'));
      const onError = jest.fn();
      const { result } = renderHook(() => useTreeRegistration({ ...DEFAULT_PARAMS, onError }));

      await act(async () => {
        await result.current.undoLast();
      });

      expect(onError).toHaveBeenCalledWith('disk I/O error');
    });

    it('executeFinalize: ante error notifica, NO navega atrás y apaga el spinner', async () => {
      (finalizeGroup as jest.Mock).mockRejectedValue(new Error('no se pudo'));
      const mockBack = jest.fn();
      const { useRouter } = require('expo-router');
      (useRouter as jest.Mock).mockReturnValue({ back: mockBack });
      const onError = jest.fn();
      const { result } = renderHook(() => useTreeRegistration({ ...DEFAULT_PARAMS, onError }));

      await act(async () => {
        await result.current.executeFinalize();
      });

      expect(onError).toHaveBeenCalledWith('no se pudo');
      expect(mockBack).not.toHaveBeenCalled();
      expect(result.current.finalizing).toBe(false);
    });
  });

  describe('derived state', () => {
    it('isReadOnly is false when subgroup is activa and user is owner', () => {
      (canEdit as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.isReadOnly).toBe(false);
    });

    it('isReadOnly is true when subgroup is finalizada', () => {
      mockLiveQueries({ group: { ...mockGroup, estado: 'finalizada' } });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.isReadOnly).toBe(true);
    });

    it('canReactivate is true when user is creator and state is finalizada', () => {
      mockLiveQueries({ group: { ...mockGroup, estado: 'finalizada', usuarioCreador: 'user-1' } });
      (canEdit as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.canReactivate).toBe(true);
    });

    it('unresolvedNN and totalCount come from useTrees', () => {
      (useTrees as jest.Mock).mockReturnValue({
        allTrees: [],
        lastThree: [],
        totalCount: 5,
        unresolvedNN: 3,
      });

      const { result } = renderHook(() => useTreeRegistration(DEFAULT_PARAMS));

      expect(result.current.unresolvedNN).toBe(3);
      expect(result.current.totalCount).toBe(5);
    });
  });
});
