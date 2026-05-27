/**
 * useNewParcela — encapsulates parcela creation/update/delete logic for
 * ParcelaFormModal (CLAUDE.md §9 — zero queries in screens/components).
 *
 * Mirrors useNewGroup shape but without `lastParcelaName` hint: technicians
 * do not request that hint for parcelas (conscious difference from Grupo).
 */
import {
  createParcela,
  updateParcela,
  deleteParcela,
} from '../repositories/ParcelaRepository';
import type {
  CreateParcelaResult,
  UpdateParcelaResult,
  DeleteParcelaResult,
} from '../repositories/ParcelaRepository';

interface ParcelaFormValues {
  nombre: string;
  codigo: string;
  descripcion?: string | null;
}

export function useNewParcela(plantacionId: string | undefined) {
  async function handleCreateParcela(values: ParcelaFormValues): Promise<CreateParcelaResult> {
    if (!plantacionId) return { success: false, error: 'unknown' };
    return createParcela({
      plantacionId,
      nombre: values.nombre,
      codigo: values.codigo,
      descripcion: values.descripcion ?? null,
    });
  }

  async function handleUpdateParcela(id: string, values: ParcelaFormValues): Promise<UpdateParcelaResult> {
    return updateParcela(id, {
      nombre: values.nombre,
      codigo: values.codigo,
      descripcion: values.descripcion ?? null,
    });
  }

  async function handleDeleteParcela(id: string): Promise<DeleteParcelaResult> {
    return deleteParcela(id);
  }

  return { handleCreateParcela, handleUpdateParcela, handleDeleteParcela };
}
