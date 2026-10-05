import { preferenciaDescargaDeFotos } from '../services/settings/descargaDeFotosStore';
import { usePreferencia } from './usePreferencia';

/** "Descargar fotos de otros celulares": la misma en Ajustes y en el modal de sincronización. */
export function useDescargaDeFotosSetting() {
  const descargarFotos = usePreferencia(preferenciaDescargaDeFotos);
  return { descargarFotos, setDescargarFotos: preferenciaDescargaDeFotos.set };
}
