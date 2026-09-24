import { useState } from 'react';
import type {
  GroupTipo,
  CreateGroupResult,
  UpdateGroupResult,
} from '../repositories/GroupRepository';
import { GROUP_TIPO_DEFAULT } from '../constants/groupTipo';
import { chocaElCodigo, chocaElNombre, esPlantacionNoEditable, MENSAJE_PLANTACION_NO_EDITABLE } from '../constants/errorDeEdicion';

interface Params {
  mode: 'create' | 'edit';
  initialValues?: { nombre: string; codigo: string; tipo: GroupTipo };
  onSubmit: (values: {
    nombre: string;
    codigo: string;
    tipo: GroupTipo;
  }) => Promise<CreateGroupResult | UpdateGroupResult>;
}

/** El formulario no tiene un error general: lo que no es de un campo se muestra bajo el código. */
function erroresDelFormulario(
  error: string,
  mode: Params['mode'],
): { nombre: string | null; codigo: string | null } {
  if (chocaElNombre(error) || chocaElCodigo(error)) {
    return {
      nombre: chocaElNombre(error) ? 'Este nombre ya existe en la parcela' : null,
      codigo: chocaElCodigo(error) ? 'Este código ya existe en la parcela' : null,
    };
  }
  if (esPlantacionNoEditable(error)) return { nombre: null, codigo: MENSAJE_PLANTACION_NO_EDITABLE };
  const generico = mode === 'create'
    ? 'Error al crear el grupo. Intentá de nuevo.'
    : 'Error al actualizar. Intentá de nuevo.';
  return { nombre: null, codigo: generico };
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
        const errores = erroresDelFormulario(result.error, mode);
        setNombreError(errores.nombre);
        setCodigoError(errores.codigo);
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
