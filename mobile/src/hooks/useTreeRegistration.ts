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
}

export function useTreeRegistration({
  grupoId,
  plantacionId,
  grupoCodigo,
  userId,
  getLastGpsFix,
}: UseTreeRegistrationParams): UseTreeRegistrationResult {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);
  const [recapturingGps, setRecapturingGps] = useState(false);

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
    await insertTreeWithGps(
      { grupoId, grupoCodigo, especieId, especieCodigo, userId },
      gpsCaptureFrequency,
      getLastGpsFix,
    );
  }, [isReadOnly, userId, grupoId, grupoCodigo, gpsCaptureFrequency, getLastGpsFix]);

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
    await deleteLastTree(grupoId);
  }, [isReadOnly, grupoId]);

  const addPhotoToTree = useCallback(async (
    treeId: string,
    pickPhoto: () => Promise<string | null>
  ) => {
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    await updateTreePhoto(treeId, photoUri);
  }, []);

  const updatePhoto = useCallback(async (treeId: string, newUri: string) => {
    await updateTreePhoto(treeId, newUri);
  }, []);

  const removePhoto = useCallback(async (treeId: string) => {
    await updateTreePhoto(treeId, '');
  }, []);

  const executeReverseOrder = useCallback(async () => {
    setReversing(true);
    try {
      await reverseTreeOrder(grupoId, grupoCodigo);
    } finally {
      setReversing(false);
    }
  }, [grupoId, grupoCodigo]);

  const executeFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      await finalizeGroup(grupoId);
      router.back();
    } finally {
      setFinalizing(false);
    }
  }, [grupoId, router]);

  const executeDeleteGroup = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteGroup(grupoId);
      router.back();
    } finally {
      setDeleting(false);
    }
  }, [grupoId, router]);

  const executeReactivate = useCallback(async () => {
    if (!grupoId || !canReactivate) return;
    await reactivateGroup(grupoId);
  }, [grupoId, canReactivate]);

  const executeDeleteTree = useCallback(async (treeId: string) => {
    setDeletingTreeId(treeId);
    try {
      await deleteTreeAndRecalculate(treeId, grupoId, grupoCodigo);
    } finally {
      setDeletingTreeId(null);
    }
  }, [grupoId, grupoCodigo]);

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
    isOwner,
    isCreator,
    dataLoaded,
    isReadOnly,
    canReactivate,
    gpsCaptureFrequency,
    gpsCaptureRequired,
    recapturingGps,
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
  };
}
