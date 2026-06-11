import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '../theme';
import { gpsGateBannerStyles as styles } from './GpsGateBanner.styles';

interface Props {
  message: string;
  unblocking: boolean;
  onRequestUnblock: () => void;
}

/**
 * Aviso de botonera bloqueada por captura GPS obligatoria, con el botón que
 * dispara los diálogos del SO. Solo bloquea el alta: el resto de la pantalla
 * (ver árboles, deshacer, etc.) sigue disponible.
 */
export default function GpsGateBanner({ message, unblocking, onRequestUnblock }: Props) {
  return (
    <View testID="gps-gate-banner" style={styles.container}>
      <Ionicons name="location-outline" size={22} color={colors.gpsRegular} />
      <Text style={styles.message}>{message}</Text>
      <Pressable
        testID="gps-gate-unblock"
        style={[styles.button, unblocking && styles.buttonDisabled]}
        onPress={onRequestUnblock}
        disabled={unblocking}
      >
        <Text style={styles.buttonText}>Habilitar GPS</Text>
      </Pressable>
    </View>
  );
}
