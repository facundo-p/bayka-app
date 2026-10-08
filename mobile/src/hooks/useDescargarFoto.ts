import { useCallback, useState } from 'react';

import { descargarFotoRemota } from '../services/SyncService';
import { FOTOS_EN_PARALELO, limitador } from '../services/sync/concurrencia';
import { notifyDataChanged } from '../database/liveQuery';

/** Las que se bajan solas al aparecer: una pantalla con muchas no las pide todas juntas. */
const enCola = limitador(FOTOS_EN_PARALELO);

/** Baja la foto de un árbol que está en la nube y no en el celular. */
export function useDescargarFoto(treeId: string, storagePath: string, onDescargada?: (uri: string) => void) {
  const [descargando, setDescargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const bajar = useCallback(async (esperarTurno: boolean) => {
    setDescargando(true);
    setFallo(false);
    try {
      const traer = () => descargarFotoRemota(treeId, storagePath);
      const uri = await (esperarTurno ? enCola(traer) : traer());
      if (!uri) {
        setFallo(true);
        return;
      }
      notifyDataChanged();
      onDescargada?.(uri);
    } finally {
      setDescargando(false);
    }
  }, [treeId, storagePath, onDescargada]);

  const descargar = useCallback(() => bajar(false), [bajar]);
  const descargarEnCola = useCallback(() => bajar(true), [bajar]);
  return { descargar, descargarEnCola, descargando, fallo };
}
