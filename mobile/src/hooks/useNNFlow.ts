import { useCallback } from 'react';
import { insertTree } from '../repositories/TreeRepository';

export interface UseNNFlowParams {
  subgrupoId: string;
  subgrupoCodigo: string;
  userId: string;
  isReadOnly: boolean;
  unresolvedNN: number;
  pickPhoto: () => Promise<string | null>;
}

export interface UseNNFlowResult {
  registerNN: () => Promise<void>;
  hasUnresolvedNN: boolean;
  nnCount: number;
}

export function useNNFlow({
  subgrupoId,
  subgrupoCodigo,
  userId,
  isReadOnly,
  unresolvedNN,
  pickPhoto,
}: UseNNFlowParams): UseNNFlowResult {

  const registerNN = useCallback(async () => {
    if (isReadOnly || !userId) return;
    const photoUri = await pickPhoto();
    if (!photoUri) return;
    await insertTree({
      subgrupoId,
      subgrupoCodigo,
      especieId: null,
      especieCodigo: 'NN',
      fotoUrl: photoUri,
      userId,
    });
  }, [isReadOnly, userId, subgrupoId, subgrupoCodigo, pickPhoto]);

  return {
    registerNN,
    hasUnresolvedNN: unresolvedNN > 0,
    nnCount: unresolvedNN,
  };
}
