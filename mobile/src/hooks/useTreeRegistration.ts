import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTrees } from './useTrees';
import { useLiveData } from '../database/liveQuery';
import { getSubgroupById } from '../queries/plantationDetailQueries';
import { getPlantationEstado } from '../queries/adminQueries';
import {
  insertTree,
  deleteLastTree,
  reverseTreeOrder,
  updateTreePhoto,
  deleteTreeAndRecalculate,
} from '../repositories/TreeRepository';
import {
  finalizeSubGroup,
  canEdit,
  deleteSubGroup,
  reactivateSubGroup,
} from '../repositories/SubGroupRepository';
import type { SubGroupEstado } from '../repositories/SubGroupRepository';

export interface UseTreeRegistrationParams {
  subgrupoId: string;
  plantacionId: string;
  subgrupoCodigo: string;
  userId: string;
}

export interface UseTreeRegistrationResult {
  // Data
  allTrees: ReturnType<typeof useTrees>['allTrees'];
  lastThree: ReturnType<typeof useTrees>['lastThree'];
  totalCount: number;
  unresolvedNN: number;
  sortedTrees: ReturnType<typeof useTrees>['allTrees'];
  subgroup: { id: string; codigo: string; tipo: string; estado: string; usuarioCreador: string } | null;
  subgroupEstado: SubGroupEstado;
  isOwner: boolean;
  isCreator: boolean;
  dataLoaded: boolean;
  isReadOnly: boolean;
  canReactivate: boolean;
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
  finalizeSubgroup: (onSuccess: () => void) => void;
  deleteSubgroup: (onConfirmed: () => void) => void;
  reactivate: (onConfirmed: () => void) => void;
  deleteTree: (treeId: string, posicion: number, onConfirmed: () => void) => void;
  executeReverseOrder: () => Promise<void>;
  executeFinalize: () => Promise<void>;
  executeDeleteSubgroup: () => Promise<void>;
  executeReactivate: () => Promise<void>;
  executeDeleteTree: (treeId: string) => Promise<void>;
}

export function useTreeRegistration({
  subgrupoId,
  plantacionId,
  subgrupoCodigo,
  userId,
}: UseTreeRegistrationParams): UseTreeRegistrationResult {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingTreeId, setDeletingTreeId] = useState<string | null>(null);

  const { allTrees, lastThree, totalCount, unresolvedNN } = useTrees(subgrupoId);

  const { data: subgroupRows } = useLiveData(
    () => getSubgroupById(subgrupoId),
    [subgrupoId]
  );
  const subgroup = subgroupRows?.[0] ?? null;
  const subgroupEstado = (subgroup?.estado ?? 'activa') as SubGroupEstado;

  const { data: plantationEstadoRows } = useLiveData(
    () => getPlantationEstado(plantacionId),
    [plantacionId]
  );
  const plantacionEstado = plantationEstadoRows ?? 'activa';

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
    await insertTree({
      subgrupoId,
      subgrupoCodigo,
      especieId,
      especieCodigo,
      userId,
    });
  }, [isReadOnly, userId, subgrupoId, subgrupoCodigo]);

  const undoLast = useCallback(async () => {
    if (isReadOnly) return;
    await deleteLastTree(subgrupoId);
  }, [isReadOnly, subgrupoId]);

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
      await reverseTreeOrder(subgrupoId, subgrupoCodigo);
    } finally {
      setReversing(false);
    }
  }, [subgrupoId, subgrupoCodigo]);

  const executeFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      await finalizeSubGroup(subgrupoId);
      router.back();
    } finally {
      setFinalizing(false);
    }
  }, [subgrupoId, router]);

  const executeDeleteSubgroup = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteSubGroup(subgrupoId);
      router.back();
    } finally {
      setDeleting(false);
    }
  }, [subgrupoId, router]);

  const executeReactivate = useCallback(async () => {
    if (!subgrupoId || !canReactivate) return;
    await reactivateSubGroup(subgrupoId);
  }, [subgrupoId, canReactivate]);

  const executeDeleteTree = useCallback(async (treeId: string) => {
    setDeletingTreeId(treeId);
    try {
      await deleteTreeAndRecalculate(treeId, subgrupoId, subgrupoCodigo);
    } finally {
      setDeletingTreeId(null);
    }
  }, [subgrupoId, subgrupoCodigo]);

  // Placeholder action starters — actual confirm logic stays in screen using confirm hook
  const reverseOrder = useCallback((onConfirmed: () => void) => {
    onConfirmed();
  }, []);

  const finalizeSubgroup = useCallback((onSuccess: () => void) => {
    onSuccess();
  }, []);

  const deleteSubgroup = useCallback((onConfirmed: () => void) => {
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
    finalizeSubgroup,
    deleteSubgroup,
    reactivate,
    deleteTree,
    executeReverseOrder,
    executeFinalize,
    executeDeleteSubgroup,
    executeReactivate,
    executeDeleteTree,
  };
}
