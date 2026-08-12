import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTrees } from './useTrees';
import { useLiveData } from '../database/liveQuery';
import { getGroupById, getPlantationGpsConfig } from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { insertTreeWithGps, recaptureTreeGps } from '../services/gps/gpsCaptureService';
import type { GpsFix } from '../services/gps/locationClient';
import {
  deleteLastTree,
  reverseTreeOrder,
  updateTreePhoto,
  deleteTreeAndRecalculate,
} from '../repositories/TreeRepository';
import {
  finalizeGroup,
  canEdit,
  deleteGroup,
  reactivateGroup,
} from '../repositories/GroupRepository';
import type { GroupEstado } from '../repositories/GroupRepository';

export interface UseTreeRegistrationParams {
  grupoId: string;
  plantacionId: string;
  grupoCodigo: string;
  userId: string;
  /** Último fix del watcher GPS de la pantalla (lectura estable, sin re-render). */
  getLastGpsFix?: () => GpsFix | null;
  /**
   * Surface de errores de escritura (#90): los writers eran fire-and-forget y
   * un throw (p.ej. grupo sin parcela) se perdía como unhandled rejection sin
   * ningún aviso al técnico. Cualquier error de escritura pasa por acá.
   */
  onError?: (mensaje: string) => void;
}

export interface UseTreeRegistrationResult {
  // Data
  allTrees: ReturnType<typeof useTrees>['allTrees'];
  lastThree: ReturnType<typeof useTrees>['lastThree'];
  totalCount: number;
  unresolvedNN: number;
  sortedTrees: ReturnType<typeof useTrees>['allTrees'];
  subgroup: { id: string; codigo: string; tipo: string; estado: string; usuarioCreador: string } | null;
  subgroupEstado: GroupEstado;
  /** Estado de la plantación ('activa' | 'finalizada' | 'sincronizada'). */
  plantacionEstado: string;
  isOwner: boolean;
  isCreator: boolean;
  dataLoaded: boolean;
  isReadOnly: boolean;
  canReactivate: boolean;
  /** Frecuencia de captura GPS vigente de la plantación (cada N árboles). */
  gpsCaptureFrequency: number;
  /** Si la plantación exige GPS operativo para registrar árboles (#102). */
  gpsCaptureRequired: boolean;
  /** true mientras la re-captura del último árbol resuelve (deshabilitar botón). */
  recapturingGps: boolean;
  /** treeId cuya captura GPS está en curso (detalle de árbol), o null. */
  gpsCapturingTreeId: string | null;
  // Loading states
  finalizing: boolean;
  reversing: boolean;
  deleting: boolean;
  deletingTreeId: string | null;
  // Actions
  registerTree: (especieId: string, especieCodigo: string) => Promise<void>;
  undoLast: () => Promise<void>;
  addPhotoToTree: (treeId: string, pickPhoto: () => Promise<string | null>) => Promise<void>;
  updatePhoto: (treeId: string, newUri: string) => Promise<void>;
  removePhoto: (treeId: string) => Promise<void>;
  reverseOrder: (onConfirmed: () => void) => void;
  confirmFinalize: (onSuccess: () => void) => void;
  confirmDeleteGroup: (onConfirmed: () => void) => void;
  reactivate: (onConfirmed: () => void) => void;
  deleteTree: (treeId: string, posicion: number, onConfirmed: () => void) => void;
  executeReverseOrder: () => Promise<void>;
  executeFinalize: () => Promise<void>;
  executeDeleteGroup: () => Promise<void>;
  executeReactivate: () => Promise<void>;
  executeDeleteTree: (treeId: string) => Promise<void>;
  /** Re-captura el punto GPS del último árbol; false si no hubo fix. */
  recaptureLastGps: () => Promise<boolean>;
  /** Captura/reemplaza el punto GPS de un árbol cualquiera; false si no hubo fix. */
  captureTreeGps: (treeId: string) => Promise<boolean>;
}

export function useTreeRegistration({
  grupoId,
  plantacionId,
  grupoCodigo,
  userId,
  getLastGpsFix,
  onError,
}: UseTreeRegistrationParams): UseTreeRegistrationResult {
  const router = useRouter();

  // Mensaje del error real si lo hay (p.ej. "Grupo X sin parcela: dato
  // inválido"); si no, el fallback de la acción.
  const notifyError = useCallback((e: unknown, fallback: string) => {
    onError?.(e instanceof Error && e.message ? e.message : fallback);
  }, [onError]);
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [recapturingGps, setRecapturingGps] = useState(false);
  const [gpsCapturingTreeId, setGpsCapturingTreeId] = useState<string | null>(null);

  const { allTrees, lastThree, totalCount, unresolvedNN } = useTrees(grupoId);

  const { data: groupRows } = useLiveData(
    () => getGroupById(grupoId),
    [grupoId]
  );
  const subgroup = groupRows?.[0] ?? null;
  const subgroupEstado = (subgroup?.estado ?? 'activa') as GroupEstado;

  const { data: plantationEstadoRows } = useLiveData(
    () => getPlantationEstado(plantacionId),
    [plantacionId]
  );
  const plantacionEstado = plantationEstadoRows ?? 'activa';

  const { data: gpsConfig } = useLiveData(
    () => getPlantationGpsConfig(plantacionId),
    [plantacionId]
  );
  const gpsCaptureFrequency = gpsConfig?.frequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT;
  const gpsCaptureRequired = gpsConfig?.required ?? GPS_CAPTURE_REQUIRED_DEFAULT;

  const isCreator = subgroup && userId ? subgroup.usuarioCreador === userId : false;
  const isOwner = subgroup && userId
    ? canEdit({ usuarioCreador: subgroup.usuarioCreador }, userId, plantacionEstado)
    : false;
  const dataLoaded = subgroup !== null && userId !== '';
  const isReadOnly = dataLoaded ? (!isOwner || subgroupEstado !== 'activa') : false;
  const canReactivate = isCreator && subgroupEstado === 'finalizada';

  const sortedTrees = [...allTrees].sort((a, b) => a.posicion - b.posicion);

  const registerTree = useCallback(async (especieId: string, especieCodigo: string) => {
    if (isReadOnly || !userId) return;
    try {
      await insertTreeWithGps(
        { grupoId, grupoCodigo, especieId, especieCodigo, userId },
        gpsCaptureFrequency,
        getLastGpsFix,
      );
    } catch (e) {
      notifyError(e, 'No se pudo registrar el árbol.');
    }
  }, [isReadOnly, userId, grupoId, grupoCodigo, gpsCaptureFrequency, getLastGpsFix, notifyError]);

  const recaptureLastGps = useCallback(async (): Promise<boolean> => {
    // allTrees viene en orden descendente: [0] es el último registrado.
    const lastTree = allTrees[0];
    if (isReadOnly || recapturingGps || !lastTree) return false;
    setRecapturingGps(true);
    try {
      return await recaptureTreeGps(lastTree.id, getLastGpsFix);
    } finally {
      setRecapturingGps(false);
    }
  }, [isReadOnly, recapturingGps, allTrees, getLastGpsFix]);

  const undoLast = useCallback(async () => {
    if (isReadOnly) return;
    try {
      await deleteLastTree(grupoId);
    } catch (e) {
      notifyError(e, 'No se pudo deshacer el último árbol.');
    }
  }, [isReadOnly, grupoId, notifyError]);

  const captureTreeGps = useCallback(async (treeId: string): Promise<boolean> => {
    setGpsCapturingTreeId(treeId);
    try {
      return await recaptureTreeGps(treeId, getLastGpsFix);
    } finally {
      setGpsCapturingTreeId(null);
    }
  }, [getLastGpsFix]);

  const addPhotoToTree = useCallback(async (
    treeId: string,
    pickPhoto: () => Promise<string | null>
  ) => {
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    try {
      await updateTreePhoto(treeId, photoUri);
    } catch (e) {
      notifyError(e, 'No se pudo guardar la foto.');
    }
  }, [notifyError]);

  const updatePhoto = useCallback(async (treeId: string, newUri: string) => {
    try {
      await updateTreePhoto(treeId, newUri);
    } catch (e) {
      notifyError(e, 'No se pudo actualizar la foto.');
    }
  }, [notifyError]);

  const removePhoto = useCallback(async (treeId: string) => {
    try {
      await updateTreePhoto(treeId, '');
    } catch (e) {
      notifyError(e, 'No se pudo quitar la foto.');
    }
  }, [notifyError]);

  const executeReverseOrder = useCallback(async () => {
    setReversing(true);
    try {
      await reverseTreeOrder(grupoId, grupoCodigo);
    } catch (e) {
      notifyError(e, 'No se pudo invertir el orden.');
    } finally {
      setReversing(false);
    }
  }, [grupoId, grupoCodigo, notifyError]);

  const executeFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      await finalizeGroup(grupoId);
      router.back();
    } catch (e) {
      notifyError(e, 'No se pudo finalizar el grupo.');
    } finally {
      setFinalizing(false);
    }
  }, [grupoId, router, notifyError]);

  const executeDeleteGroup = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteGroup(grupoId);
      router.back();
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el grupo.');
    } finally {
      setDeleting(false);
    }
  }, [grupoId, router, notifyError]);

  const executeReactivate = useCallback(async () => {
    if (!grupoId || !canReactivate) return;
    try {
      await reactivateGroup(grupoId);
    } catch (e) {
      notifyError(e, 'No se pudo reactivar el grupo.');
    }
  }, [grupoId, canReactivate, notifyError]);

  const executeDeleteTree = useCallback(async (treeId: string) => {
    setDeletingTreeId(treeId);
    try {
      await deleteTreeAndRecalculate(treeId, grupoId, grupoCodigo);
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el árbol.');
    } finally {
      setDeletingTreeId(null);
    }
  }, [grupoId, grupoCodigo, notifyError]);

  // Placeholder action starters — actual confirm logic stays in screen using confirm hook
  const reverseOrder = useCallback((onConfirmed: () => void) => {
    onConfirmed();
  }, []);

  const confirmFinalize = useCallback((onSuccess: () => void) => {
    onSuccess();
  }, []);

  const confirmDeleteGroup = useCallback((onConfirmed: () => void) => {
    onConfirmed();
  }, []);

  const reactivate = useCallback((onConfirmed: () => void) => {
    onConfirmed();
  }, []);

  const deleteTree = useCallback((treeId: string, posicion: number, onConfirmed: () => void) => {
    onConfirmed();
  }, []);

  return {
    allTrees,
    lastThree,
    totalCount,
    unresolvedNN,
    sortedTrees,
    subgroup,
    subgroupEstado,
    plantacionEstado,
    isOwner,
    isCreator,
    dataLoaded,
    isReadOnly,
    canReactivate,
    gpsCaptureFrequency,
    gpsCaptureRequired,
    recapturingGps,
    gpsCapturingTreeId,
    finalizing,
    reversing,
    deleting,
    deletingTreeId,
    registerTree,
    undoLast,
    addPhotoToTree,
    updatePhoto,
    removePhoto,
    reverseOrder,
    confirmFinalize,
    confirmDeleteGroup,
    reactivate,
    deleteTree,
    executeReverseOrder,
    executeFinalize,
    executeDeleteGroup,
    executeReactivate,
    executeDeleteTree,
    recaptureLastGps,
    captureTreeGps,
  };
}
