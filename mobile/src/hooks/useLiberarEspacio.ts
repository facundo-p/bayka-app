import { useCallback, useState } from 'react';

import { notifyDataChanged, useLiveData } from '../database/liveQuery';
import {
  liberarEspacio,
  prepararLiberacion,
  resumenDeEspacio,
  type PlanDeLiberacion,
} from '../services/LiberarEspacioService';
import { showConfirmDialog, showInfoDialog, type ShowFn } from '../utils/alertHelpers';
import {
  MENSAJE_SIN_CONEXION,
  mensajeConfirmarLiberar,
  mensajeLiberado,
  mensajeNadaParaLiberar,
} from '../utils/avisoLiberarEspacio';
import { colors } from '../theme';

async function planONull(): Promise<PlanDeLiberacion | null> {
  try {
    return await prepararLiberacion();
  } catch (e) {
    console.error('[LiberarEspacio] no se pudo confirmar con el server', e);
    return null;
  }
}

/** "Liberar espacio" de Ajustes: resumen en vivo y el flujo verificar → confirmar → liberar. */
export function useLiberarEspacio(show: ShowFn, descargarFotos: boolean) {
  const { data: resumen } = useLiveData(resumenDeEspacio, []);
  const [ocupado, setOcupado] = useState(false);

  const confirmar = useCallback(async (plan: PlanDeLiberacion) => {
    setOcupado(true);
    try {
      const liberado = await liberarEspacio(plan);
      notifyDataChanged();
      showInfoDialog(show, 'Espacio liberado', mensajeLiberado(liberado.fotos, liberado.bytes), 'checkmark-circle-outline', colors.plantation);
    } catch (e) {
      console.error('[LiberarEspacio] falló', e);
      showInfoDialog(show, 'Error', 'No se pudo liberar el espacio. No se borró ninguna foto.', 'alert-circle-outline', colors.danger);
    } finally {
      setOcupado(false);
    }
  }, [show]);

  const iniciar = useCallback(async () => {
    setOcupado(true);
    const plan = await planONull();
    setOcupado(false);
    if (!plan) {
      showInfoDialog(show, 'Sin conexión', MENSAJE_SIN_CONEXION, 'cloud-offline-outline', colors.danger);
      return;
    }
    if (plan.fotos.length === 0) {
      showInfoDialog(show, 'Nada para liberar', mensajeNadaParaLiberar(plan.sinConfirmar), 'information-circle-outline');
      return;
    }
    const mensaje = mensajeConfirmarLiberar({ ...plan, fotos: plan.fotos.length, descargarFotos });
    showConfirmDialog(show, 'Liberar espacio', mensaje, 'Liberar espacio', () => confirmar(plan), {
      icon: 'trash-outline', iconColor: colors.danger, style: 'danger',
    });
  }, [show, descargarFotos, confirmar]);

  return { resumen, ocupado, iniciar };
}
