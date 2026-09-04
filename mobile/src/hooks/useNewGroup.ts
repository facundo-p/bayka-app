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
    let stale = false;
    getLastGroupName(plantacionId)
      .then((name) => {
        if (!stale) setLastGroupName(name);
      })
      .catch(() => {
        if (!stale) setLastGroupName(null);
      });
    return () => {
      stale = true;
    };
  }, [plantacionId]);

  async function handleCreateGroup(values: { nombre: string; codigo: string; tipo: GroupTipo }) {
    // parcela obligatoria (#90): la pantalla garantiza el param; sin él no se crea.
    if (!userId || !plantacionId || !parcelaId) {
      return { success: false as const, error: 'unknown' as const };
    }
    return createGroup({
      plantacionId,
      parcelaId,
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
