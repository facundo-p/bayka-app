import { useCallback } from 'react';
import { insertTree } from '../repositories/TreeRepository';

export interface UseNNFlowParams {
  grupoId: string;
  grupoCodigo: string;
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
  grupoId,
  grupoCodigo,
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
      grupoId,
      grupoCodigo,
      especieId: null,
      especieCodigo: 'NN',
      fotoUrl: photoUri,
      userId,
    });
  }, [isReadOnly, userId, grupoId, grupoCodigo, pickPhoto]);

  return {
    registerNN,
    hasUnresolvedNN: unresolvedNN > 0,
    nnCount: unresolvedNN,
  };
}
