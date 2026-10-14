/**
 * Plantaciones que la sync global no pudo sincronizar porque el server ya no las
 * reconoce (#478). Devuelve null si no hay ninguna.
 */
import { View } from 'react-native';
import GrupoDeAviso from './GrupoDeAviso';
import { hayOmitidas } from '../services/SyncService';
import type { PlantacionesOmitidas } from '../services/SyncService';
import { plantacionesOmitidasAvisoStyles as styles } from './PlantacionesOmitidasAviso.styles';

export const TEXTO_OMITIDA_ELIMINADA =
  'Fue eliminada en el servidor. No se sincronizó y lo que quedó sin subir no se puede subir. Podés consultarla o eliminarla del dispositivo.';
export const TEXTO_OMITIDA_SIN_ACCESO =
  'Un administrador te quitó el acceso. No se sincronizó; los datos quedan solo para consulta.';

export default function PlantacionesOmitidasAviso({ omitidas }: { omitidas: PlantacionesOmitidas }) {
  if (!hayOmitidas(omitidas)) return null;
  return (
    <View style={styles.seccion}>
      <GrupoDeAviso titulo="Eliminadas en el servidor" nombres={omitidas.eliminadas} explicacion={TEXTO_OMITIDA_ELIMINADA} />
      <GrupoDeAviso titulo="Sin acceso" nombres={omitidas.sinAcceso} explicacion={TEXTO_OMITIDA_SIN_ACCESO} />
    </View>
  );
}
