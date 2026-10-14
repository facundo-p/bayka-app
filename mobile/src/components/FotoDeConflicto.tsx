import { useEffect } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import { useDescargarFoto } from '../hooks/useDescargarFoto';
import { isLocalUri } from '../utils/photoUri';
import type { FotoDeOpcion } from '../utils/vistaDeConflicto';
import { fotoDeConflictoStyles as styles } from './FotoDeConflicto.styles';

function SinConexion({ descripcion }: Pick<FotoDeOpcion, 'descripcion'>) {
  return (
    <View testID="foto-sin-conexion" style={[styles.miniatura, styles.marcador]} accessible accessibilityLabel={descripcion}>
      <Ionicons name="cloud-offline-outline" size={iconSizes.checkbox} color={colors.textSecondary} />
      <Text style={styles.marcadorTexto}>Se ve cuando haya conexión</Text>
    </View>
  );
}

function Reintentar({ descripcion, onPress }: { descripcion: string; onPress: () => void }) {
  return (
    <Pressable
      testID="foto-reintentar"
      style={[styles.miniatura, styles.marcador]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${descripcion}: no se pudo bajar. Tocá para reintentar`}
    >
      <Ionicons name="refresh-outline" size={iconSizes.checkbox} color={colors.textSecondary} />
      <Text style={styles.marcadorTexto}>No se pudo bajar. Reintentar</Text>
    </Pressable>
  );
}

/** Se baja sola al aparecer, en cola con las demás; mientras tanto ocupa el lugar de la miniatura. */
function FotoDelServidor({ treeId, uri, descripcion }: FotoDeOpcion) {
  const { descargar, descargarEnCola, descargando, fallo } = useDescargarFoto(treeId, uri);
  useEffect(() => {
    void descargarEnCola();
  }, [descargarEnCola]);

  if (fallo && !descargando) return <Reintentar descripcion={descripcion} onPress={descargar} />;
  return (
    <View testID="foto-descargando" style={[styles.miniatura, styles.marcador]} accessible accessibilityLabel={`${descripcion}, bajando`}>
      <ActivityIndicator size="small" color={colors.textSecondary} />
    </View>
  );
}

/** La foto de un lado del conflicto. La del servidor se baja al mostrarla, si hay conexión. */
export default function FotoDeConflicto(props: FotoDeOpcion) {
  const { uri, enLinea, descripcion } = props;
  if (isLocalUri(uri)) {
    return <Image source={{ uri }} style={styles.miniatura} resizeMode="cover" accessible accessibilityLabel={descripcion} accessibilityIgnoresInvertColors />;
  }
  if (!enLinea) return <SinConexion descripcion={descripcion} />;
  return <FotoDelServidor {...props} />;
}
