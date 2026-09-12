import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTrees } from './useTrees';
import { useLiveData } from '../database/liveQuery';
import { getGroupById, getPlantationCaptureConfig } from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import { GPS_CAPTURE_FREQUENCY_DEFAULT, GPS_CAPTURE_REQUIRED_DEFAULT } from '../constants/gpsCapture';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../constants/photoCapture';
import { insertTreeWithGps, recaptureTreeGps } from '../services/gps/gpsCaptureService';
import type { GpsFix } from '../services/gps/locationClient';
import {
  NN_PHOTO_POLICY,
  resolvePhotoForRegistration,
  speciesPhotoPolicy,
  type PhotoPolicy,
  type PickPhoto,
} from '../services/photo/photoCaptureRules';
import { UNKNOWN_SPECIES_CODE } from '../utils/speciesHelpers';
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
import { ESTADO_GRUPO, ESTADO_PLANTACION } from '../constants/estados';

export interface UseTreeRegistrationParams {
  grupoId: string;
  plantacionId: string;
  grupoCodigo: string;
  userId: string;
  /** Selector de foto de la pantalla: lo usan N/N, la botonera con "foto en todos los botones" y el detalle de árbol. */
  pickPhoto: PickPhoto;
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
  /** Si todos los botones de especie piden foto, como N/N (#439). */
  photoCaptureAllTrees: boolean;
  /** true mientras la re-captura del último árbol resuelve (deshabilitar botón). */
  recapturingGps: boolean;
  /** treeId cuya captura GPS está en curso (detalle de árbol), o null. */
  gpsCapturingTreeId: string | null;
  finalizing: boolean;
  reversing: boolean;
  deleting: boolean;
  deletingTreeId: string | null;
  registerTree: (especieId: string, especieCodigo: string) => Promise<void>;
  /** Alta de N/N: foto obligatoria, sin especie. */
  registerNN: () => Promise<void>;
  undoLast: () => Promise<void>;
  addPhotoToTree: (treeId: string) => Promise<void>;
  updatePhoto: (treeId: string, newUri: string) => Promise<void>;
  removePhoto: (treeId: string) => Promise<void>;
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
  pickPhoto,
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
  const subgroupEstado = (subgroup?.estado ?? ESTADO_GRUPO.activa) as GroupEstado;

  const { data: plantationEstadoRows } = useLiveData(
    () => getPlantationEstado(plantacionId),
    [plantacionId]
  );
  const plantacionEstado = plantationEstadoRows ?? ESTADO_PLANTACION.activa;

  const { data: captureConfig } = useLiveData(
    () => getPlantationCaptureConfig(plantacionId),
    [plantacionId]
  );
  const gpsCaptureFrequency = captureConfig?.gpsFrequency ?? GPS_CAPTURE_FREQUENCY_DEFAULT;
  const gpsCaptureRequired = captureConfig?.gpsRequired ?? GPS_CAPTURE_REQUIRED_DEFAULT;
  const photoCaptureAllTrees = captureConfig?.photoAllTrees ?? PHOTO_CAPTURE_ALL_TREES_DEFAULT;

  const isCreator = subgroup && userId ? subgroup.usuarioCreador === userId : false;
  const isOwner = subgroup && userId
    ? canEdit({ usuarioCreador: subgroup.usuarioCreador }, userId, plantacionEstado)
    : false;
  const dataLoaded = subgroup !== null && userId !== '';
  const isReadOnly = dataLoaded ? (!isOwner || subgroupEstado !== ESTADO_GRUPO.activa) : false;
  const canReactivate = isCreator && subgroupEstado === ESTADO_GRUPO.finalizada;

  const sortedTrees = [...allTrees].sort((a, b) => a.posicion - b.posicion);

  // Camino único de alta (especie o N/N): foto según política y recién después el
  // insert. El "tap" GPS es post-foto: el técnico sigue parado junto al árbol y
  // el watcher pudo pausarse mientras la cámara tuvo el foco.
  const registerWithPolicy = useCallback(async (
    policy: PhotoPolicy,
    especie: { especieId: string | null; especieCodigo: string },
    fallbackError: string,
  ) => {
    if (isReadOnly || !userId) return;
    const photo = await resolvePhotoForRegistration(policy, pickPhoto);
    if (!photo.proceed) return;
    try {
      await insertTreeWithGps(
        { grupoId, grupoCodigo, ...especie, fotoUrl: photo.fotoUrl, userId },
        gpsCaptureFrequency,
        getLastGpsFix,
      );
    } catch (e) {
      notifyError(e, fallbackError);
    }
  }, [isReadOnly, userId, pickPhoto, grupoId, grupoCodigo, gpsCaptureFrequency, getLastGpsFix, notifyError]);

  const registerTree = useCallback(
    (especieId: string, especieCodigo: string) =>
      registerWithPolicy(
        speciesPhotoPolicy(photoCaptureAllTrees),
        { especieId, especieCodigo },
        'No se pudo registrar el árbol.',
      ),
    [registerWithPolicy, photoCaptureAllTrees],
  );

  const registerNN = useCallback(
    () =>
      registerWithPolicy(
        NN_PHOTO_POLICY,
        { especieId: null, especieCodigo: UNKNOWN_SPECIES_CODE },
        'No se pudo registrar el árbol N/N.',
      ),
    [registerWithPolicy],
  );

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

  const addPhotoToTree = useCallback(async (treeId: string) => {
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    try {
      await updateTreePhoto(treeId, photoUri);
    } catch (e) {
      notifyError(e, 'No se pudo guardar la foto.');
    }
  }, [pickPhoto, notifyError]);

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
    photoCaptureAllTrees,
    recapturingGps,
    gpsCapturingTreeId,
    finalizing,
    reversing,
    deleting,
    deletingTreeId,
    registerTree,
    registerNN,
    undoLast,
    addPhotoToTree,
    updatePhoto,
    removePhoto,
    executeReverseOrder,
    executeFinalize,
    executeDeleteGroup,
    executeReactivate,
    executeDeleteTree,
    recaptureLastGps,
    captureTreeGps,
  };
}
