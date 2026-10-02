import { useCallback, useState } from 'react';
import { notifyDataChanged } from '../database/liveQuery';
import {
  asegurarFotoLocal,
  compartirFoto,
  guardarFotoEnGaleria,
} from '../services/FotoExportService';
import { RESULTADO_FOTO, type ResultadoFoto } from '../constants/fotoAcciones';
import { avisoBreve } from '../utils/avisoBreve';
import { mensajeDeFoto } from '../utils/mensajeDeFoto';
import { syncLog } from '../utils/syncLogger';

type Accion = (uriLocal: string, treeId: string | undefined) => Promise<ResultadoFoto>;

/** Guardar / compartir la foto abierta en el visor. `onDescargada` avisa si hubo que bajarla. */
export function useAccionesDeFoto(
  uri: string | null,
  treeId: string | undefined,
  onDescargada?: (uriLocal: string) => void,
) {
  const [ocupado, setOcupado] = useState(false);

  const ejecutar = useCallback(async (accion: Accion) => {
    if (!uri || ocupado) return;
    setOcupado(true);
    try {
      const foto = await asegurarFotoLocal(uri, treeId);
      let resultado: ResultadoFoto = RESULTADO_FOTO.sinConexion;
      if (foto) {
        if (foto.descargadaAhora) {
          notifyDataChanged();
          onDescargada?.(foto.uri);
        }
        resultado = await accion(foto.uri, treeId);
      }
      const mensaje = mensajeDeFoto(resultado);
      if (mensaje) avisoBreve(mensaje);
    } catch (e) {
      syncLog.error('Acción sobre la foto falló:', e);
      avisoBreve(mensajeDeFoto(RESULTADO_FOTO.error)!);
    } finally {
      setOcupado(false);
    }
  }, [uri, treeId, ocupado, onDescargada]);

  return {
    ocupado,
    guardar: () => ejecutar(guardarFotoEnGaleria),
    compartir: () => ejecutar(compartirFoto),
  };
}
