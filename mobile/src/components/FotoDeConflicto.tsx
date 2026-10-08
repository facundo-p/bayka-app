import { View, Text, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import { isLocalUri } from '../utils/photoUri';
import type { FotoDeOpcion } from '../utils/vistaDeConflicto';
import FotoRemota from './FotoRemota';
import { fotoDeConflictoStyles as styles } from './FotoDeConflicto.styles';

function SinConexion() {
  return (
    <View testID="foto-sin-conexion" style={[styles.miniatura, styles.sinConexion]}>
      <Ionicons name="cloud-offline-outline" size={iconSizes.checkbox} color={colors.textSecondary} />
      <Text style={styles.sinConexionTexto}>Se ve cuando haya conexión</Text>
    </View>
  );
}

/** La foto de un lado del conflicto. La del servidor se baja al mostrarla, si hay conexión. */
export default function FotoDeConflicto({ treeId, uri, enLinea }: FotoDeOpcion) {
  if (isLocalUri(uri)) return <Image source={{ uri }} style={styles.miniatura} accessibilityIgnoresInvertColors />;
  if (!enLinea) return <SinConexion />;
  return <FotoRemota treeId={treeId} storagePath={uri} style={styles.remota} descargarAlMostrar />;
}
