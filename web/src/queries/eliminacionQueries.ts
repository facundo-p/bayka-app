/** Previsualización del borrado real de una plantación (#478): qué se pierde y si se puede. */
import { supabase } from '../lib/supabase';
import { ERROR_ELIMINACION } from '../../../supabase/functions/admin-plantaciones/nucleo';

/** Por qué no se puede eliminar; null = se puede (con datos, escribiendo el nombre). */
export const MOTIVO_NO_ELIMINABLE = {
  requiereSuperadmin: ERROR_ELIMINACION.requiereSuperadmin,
  requiereArchivar: ERROR_ELIMINACION.requiereArchivar,
} as const;

export type MotivoNoEliminable = (typeof MOTIVO_NO_ELIMINABLE)[keyof typeof MOTIVO_NO_ELIMINABLE];

export type PreviewEliminacion = {
  parcelas: number;
  grupos: number;
  arboles: number;
  arbolesConFoto: number;
  /** Algún grupo o árbol: con datos, solo superadmin, archivada y con el nombre. */
  tieneDatos: boolean;
  motivo: MotivoNoEliminable | null;
};

type FilaPreview = {
  success?: boolean;
  parcelas: number;
  grupos: number;
  arboles: number;
  arboles_con_foto: number;
  tiene_datos: boolean;
  motivo: MotivoNoEliminable | null;
} | null;

export const MENSAJE_ERROR_PREVIEW = 'No se pudo consultar qué datos tiene la plantación.';

function mapearPreview(fila: NonNullable<FilaPreview>): PreviewEliminacion {
  return {
    parcelas: fila.parcelas,
    grupos: fila.grupos,
    arboles: fila.arboles,
    arbolesConFoto: fila.arboles_con_foto,
    tieneDatos: fila.tiene_datos,
    motivo: fila.motivo,
  };
}

/** Sin permiso responde `{ success: false }`: se trata igual que un error. */
export async function previsualizarEliminacion(plantationId: string): Promise<PreviewEliminacion> {
  const { data, error } = await supabase.rpc('previsualizar_eliminacion_plantacion', {
    p_id: plantationId,
  });
  const fila = data as FilaPreview;
  if (error || !fila?.success) throw new Error(MENSAJE_ERROR_PREVIEW);
  return mapearPreview(fila);
}
