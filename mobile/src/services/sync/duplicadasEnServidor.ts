/**
 * Después de subir una plantación, avisa si el server ya tiene otra con el mismo
 * lugar y periodo (#633): el aviso del formulario solo ve las del dispositivo.
 */
import { supabase } from '../../supabase/client';
import { syncLog } from '../../utils/syncLogger';
import { relanzarSiEsCancelacion } from './cancelacion';
import type { SyncPlantationResult } from './types';

type PlantacionSubida = { id: string; lugar: string; periodo: string };

/**
 * Mismo chequeo que la web: `ilike` sin distinguir mayúsculas. `%` y `_` actúan de
 * comodín, pero siendo solo un aviso un falso positivo es aceptable. Si falla, no hay aviso:
 * nunca frena la subida.
 */
export async function hayOtraEnServidor(plantacion: PlantacionSubida): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('plantations')
      .select('id', { count: 'exact', head: true })
      .ilike('lugar', plantacion.lugar.trim())
      .ilike('periodo', plantacion.periodo.trim())
      .neq('id', plantacion.id);
    if (error) {
      syncLog.error('Chequeo de duplicado falló:', plantacion.id, error.message);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (e: any) {
    relanzarSiEsCancelacion(e);
    syncLog.error('Chequeo de duplicado falló:', plantacion.id, e?.message ?? e);
    return false;
  }
}

/** Nombres de las subidas en este sync que chocan con otra del server. */
export function nombresDeDuplicadas(resultados: SyncPlantationResult[]): string[] {
  return resultados.filter((r) => r.success && r.duplicada).map((r) => r.nombre);
}
