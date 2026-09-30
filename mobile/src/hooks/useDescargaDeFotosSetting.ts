import { preferenciaDescargaDeFotos } from '../services/settings/descargaDeFotosStore';
import { usePreferenciaBooleana } from './usePreferenciaBooleana';

/** "Descargar fotos de otros celulares": la misma en Ajustes y en el modal de sincronización. */
export function useDescargaDeFotosSetting() {
  const descargarFotos = usePreferenciaBooleana(preferenciaDescargaDeFotos);
  return { descargarFotos, setDescargarFotos: preferenciaDescargaDeFotos.set };
}
