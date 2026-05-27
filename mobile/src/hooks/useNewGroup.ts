/**
 * useNewGroup — all data logic for NuevoGrupoScreen.
 *
 * Encapsulates last subgroup name loading and subgroup creation logic.
 */
import { useState, useEffect } from 'react';
import { createGroup, getLastGroupName } from '../repositories/GroupRepository';
import type { GroupTipo } from '../repositories/GroupRepository';
import { useCurrentUserId } from './useCurrentUserId';

export function useNewGroup(plantacionId: string | undefined, parcelaId?: string) {
  const userId = useCurrentUserId();
  const [lastGroupName, setLastGroupName] = useState<string | null>(null);

  useEffect(() => {
    if (!plantacionId) return;
    getLastGroupName(plantacionId).then(setLastGroupName);
  }, [plantacionId]);

  async function handleCreateGroup(values: { nombre: string; codigo: string; tipo: GroupTipo }) {
    if (!userId) {
      return { success: false as const, error: 'unknown' as const };
    }
    return createGroup({
      plantacionId: plantacionId ?? '',
      parcelaId: parcelaId ?? null,
      nombre: values.nombre,
      codigo: values.codigo,
      tipo: values.tipo,
      usuarioCreador: userId,
    });
  }

  return {
    lastGroupName,
    handleCreateGroup,
  };
}
