import { useState } from 'react';
import type {
  GroupTipo,
  CreateGroupResult,
  UpdateGroupResult,
} from '../repositories/GroupRepository';
import { GROUP_TIPO_DEFAULT } from '../constants/groupTipo';

interface Params {
  mode: 'create' | 'edit';
  initialValues?: { nombre: string; codigo: string; tipo: GroupTipo };
  onSubmit: (values: {
    nombre: string;
    codigo: string;
    tipo: GroupTipo;
  }) => Promise<CreateGroupResult | UpdateGroupResult>;
}

/**
 * Estado y submit del formulario de grupo, extraído de GrupoForm (#89) para que
 * la botonera pueda vivir en un footer fijo (NuevoGrupoScreen) sin duplicar la
 * lógica de validación/errores que también usa el bottom-sheet de edición.
 */
export function useGrupoForm({ mode, initialValues, onSubmit }: Params) {
  const [nombre, setNombre] = useState(initialValues?.nombre ?? '');
  const [codigo, setCodigo] = useState(initialValues?.codigo ?? '');
  const [tipo, setTipo] = useState<GroupTipo>(initialValues?.tipo ?? GROUP_TIPO_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);

  const canSubmit = nombre.trim().length > 0 && codigo.trim().length > 0 && !loading;

  function handleNombreChange(val: string) {
    setNombre(val);
    if (nombreError) setNombreError(null);
  }

  function handleCodigoChange(val: string) {
    setCodigo(val.toUpperCase());
    if (codigoError) setCodigoError(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setNombreError(null);
    setCodigoError(null);
    setLoading(true);
    try {
      const result = await onSubmit({
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        tipo,
      });
      if (!result.success) {
        if (result.error === 'both_duplicate') {
          setNombreError('Este nombre ya existe en la parcela');
          setCodigoError('Este código ya existe en la parcela');
        } else if (result.error === 'nombre_duplicate') {
          setNombreError('Este nombre ya existe en la parcela');
        } else if (result.error === 'codigo_duplicate') {
          setCodigoError('Este código ya existe en la parcela');
        } else {
          setCodigoError(
            mode === 'create'
              ? 'Error al crear el grupo. Intentá de nuevo.'
              : 'Error al actualizar. Intentá de nuevo.',
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    nombre,
    codigo,
    tipo,
    setTipo,
    nombreError,
    codigoError,
    loading,
    canSubmit,
    handleNombreChange,
    handleCodigoChange,
    handleSubmit,
  };
}
