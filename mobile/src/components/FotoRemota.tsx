import { View, Text, Pressable, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { useDescargarFoto } from '../hooks/useDescargarFoto';
import { fotoRemotaStyles as styles } from './FotoRemota.styles';

interface Props {
  treeId: string;
  /** Path de Storage de la foto. */
  storagePath: string;
  /** Sobre fondo oscuro (visor a pantalla completa). */
  oscuro?: boolean;
  style?: StyleProp<ViewStyle>;
  onDescargada?: (uri: string) => void;
}

/** Foto que está en la nube y no en este celular (#53): se baja de a una. */
export default function FotoRemota({ treeId, storagePath, oscuro, style, onDescargada }: Props) {
  const { descargar, descargando, fallo } = useDescargarFoto(treeId, storagePath, onDescargada);

  return (
    <View testID="foto-remota" style={[styles.contenedor, oscuro && styles.contenedorOscuro, style]}>
      <Ionicons name="cloud-outline" size={32} color={oscuro ? colors.white : colors.textMuted} />
      <Text style={[styles.texto, oscuro && styles.textoOscuro]}>Foto sin descargar en este celular</Text>
      <Pressable
        style={styles.boton}
        onPress={descargar}
        disabled={descargando}
        accessibilityRole="button"
        accessibilityLabel="Descargar foto"
      >
        {descargando ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="cloud-download-outline" size={18} color={colors.white} />
            <Text style={styles.botonTexto}>Descargar</Text>
          </>
        )}
      </Pressable>
      {fallo && (
        <Text style={[styles.error, oscuro && styles.errorOscuro]}>
          No se pudo descargar. Revisá la conexión y probá de nuevo.
        </Text>
      )}
    </View>
  );
}
