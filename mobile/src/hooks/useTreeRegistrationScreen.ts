import { useCallback } from 'react';
import { usePhotoCaptureFlow } from '../components/PhotoCropProvider';
import type { PickPhoto } from '../services/photo/photoCaptureRules';
import { colors } from '../theme';
import { showInfoDialog, type ShowFn } from '../utils/alertHelpers';
import { getCambioDeEspecie, getTreeEditGating } from '../utils/permisosDeEdicion';
import { useAccionesDeArbol } from './useAccionesDeArbol';
import { useAccionesDeGrupo } from './useAccionesDeGrupo';
import { useConfirm } from './useConfirm';
import { useCurrentUserId } from './useCurrentUserId';
import { useEstiloBotonera } from './useEstiloBotonera';
import { useFotoDelSeleccionado } from './useFotoDelSeleccionado';
import { useFotoDelVisor } from './useFotoDelVisor';
import { useGpsEnabledSetting } from './useGpsEnabledSetting';
import { useGpsGate } from './useGpsGate';
import { useGpsWatcher } from './useGpsWatcher';
import { useSpeciesOrder } from './useSpeciesOrder';
import { useTreeRegistration, type UseTreeRegistrationResult } from './useTreeRegistration';
import { useTreeSelection } from './useTreeSelection';

export interface ParamsDelGrupo {
  grupoId?: string;
  plantacionId?: string;
  grupoCodigo?: string;
}

type Registro = { userId: string; pickPhoto: PickPhoto; show: ShowFn };

function useRegistroConGps(grupo: ParamsDelGrupo, { userId, pickPhoto, show }: Registro) {
  // Surface de errores de escritura (#90): notifica cualquier writer que
  // falle (registro, borrado, foto, finalización).
  const onError = useCallback((mensaje: string) => {
    showInfoDialog(show, 'Error', mensaje, 'alert-circle-outline', colors.danger);
  }, [show]);
  const { gpsEnabled } = useGpsEnabledSetting();
  const gpsWatcher = useGpsWatcher(gpsEnabled);
  const treeReg = useTreeRegistration({
    grupoId: grupo.grupoId ?? '', plantacionId: grupo.plantacionId ?? '', grupoCodigo: grupo.grupoCodigo ?? '',
    userId, pickPhoto, getLastGpsFix: gpsWatcher.getLastFix, onError,
  });
  const gpsGate = useGpsGate({
    required: treeReg.gpsCaptureRequired, gpsEnabled, permissionStatus: gpsWatcher.permissionStatus,
    servicesEnabled: gpsWatcher.servicesEnabled, refreshWatcher: gpsWatcher.refresh,
  });
  return { treeReg, gpsWatcher, gpsGate };
}

function useFotosDelGrupo(treeReg: UseTreeRegistrationResult, { pickPhoto, show }: Registro) {
  const treeSelection = useTreeSelection(treeReg.sortedTrees);
  const visor = useFotoDelVisor({
    arboles: treeReg.sortedTrees, show, pickPhoto,
    updatePhoto: treeReg.updatePhoto, removePhoto: treeReg.removePhoto,
  });
  const fotoDelSeleccionado = useFotoDelSeleccionado({
    arbol: treeSelection.selectedTree, capturar: treeReg.addPhotoToTree, show, onVerActual: visor.abrir,
  });
  return { treeSelection, visor, fotoDelSeleccionado };
}

/** Gating del detalle de árbol (#155). */
function permisosDeArbol(treeReg: UseTreeRegistrationResult) {
  const gating = { plantacion: treeReg.plantacion, subgroupEstado: treeReg.subgroupEstado, isCreator: treeReg.isCreator };
  return { ...getTreeEditGating(gating), cambioDeEspecie: getCambioDeEspecie(gating) };
}

/** Hooks de la pantalla de registro de árboles, compuestos en el orden que exigen sus dependencias. */
export function useTreeRegistrationScreen(grupo: ParamsDelGrupo) {
  const userId = useCurrentUserId() ?? '';
  const confirm = useConfirm();
  const { pickPhoto } = usePhotoCaptureFlow();
  const registro = { userId, pickPhoto, show: confirm.show };
  const { treeReg, gpsWatcher, gpsGate } = useRegistroConGps(grupo, registro);
  const fotos = useFotosDelGrupo(treeReg, registro);
  const speciesOrder = useSpeciesOrder(grupo.plantacionId ?? '');
  const botonera = useEstiloBotonera();
  const accionesDeGrupo = useAccionesDeGrupo(treeReg, confirm.show, grupo.grupoId);
  const accionesDeArbol = useAccionesDeArbol(treeReg, confirm.show, fotos.treeSelection.selectedTree);
  return {
    userId, confirm, treeReg, gpsWatcher, gpsGate, ...fotos, speciesOrder, botonera,
    accionesDeGrupo, accionesDeArbol, permisos: permisosDeArbol(treeReg),
  };
}
