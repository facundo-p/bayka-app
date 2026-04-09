/**
 * useNewSubgroup — all data logic for NuevoSubgrupoScreen.
 *
 * Encapsulates last subgroup name loading and subgroup creation logic.
 */
import { useState, useEffect } from 'react';
import { createSubGroup, getLastSubGroupName } from '../repositories/SubGroupRepository';
import type { SubGroupTipo } from '../repositories/SubGroupRepository';
import { useCurrentUserId } from './useCurrentUserId';

export function useNewSubgroup(plantacionId: string | undefined) {
  const userId = useCurrentUserId();
  const [lastSubGroupName, setLastSubGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!plantacionId) return;
    getLastSubGroupName(plantacionId).then(setLastSubGroupName);
  }, [plantacionId]);

  async function handleCreateSubgroup(values: { nombre: string; codigo: string; tipo: SubGroupTipo }) {
    if (!userId) {
      return { success: false as const, error: 'unknown' as const };
    }
    return createSubGroup({
      plantacionId: plantacionId ?? '',
      nombre: values.nombre,
      codigo: values.codigo,
      tipo: values.tipo,
      usuarioCreador: userId,
    });
  }

  return {
    lastSubGroupName,
    handleCreateSubgroup,
  };
}
