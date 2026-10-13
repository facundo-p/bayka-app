/** Aviso en la cámara del punto GPS del toque que todavía no llegó (#912): esperar o alejarse lo decide el técnico. */
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, touchTarget } from '../theme';
import { AVISO_PUNTO_GPS, type AvisoPuntoGps as Aviso } from '../hooks/useAvisoPuntoGps';
import { formatGpsAccuracy } from '../utils/gpsAccuracyFormat';
import { avisoPuntoGpsStyles as styles, AVISO_PUNTO_GPS_ICON_SIZE } from './AvisoPuntoGps.styles';

function textoDelAviso(aviso: Aviso): string {
  switch (aviso.estado) {
    case AVISO_PUNTO_GPS.esperando: return 'Tomando punto GPS…';
    case AVISO_PUNTO_GPS.tomado: return `Punto GPS tomado · ${formatGpsAccuracy(aviso.precision)}`;
    case AVISO_PUNTO_GPS.sinPunto: return 'Sin punto GPS';
  }
}

function IconoDelAviso({ aviso }: { aviso: Aviso }) {
  switch (aviso.estado) {
    case AVISO_PUNTO_GPS.esperando:
      return <ActivityIndicator testID="aviso-gps-spinner" size="small" color={colors.plantation} />;
    case AVISO_PUNTO_GPS.tomado:
      return <Ionicons name="checkmark-circle" size={AVISO_PUNTO_GPS_ICON_SIZE} color={colors.gpsGood} />;
    case AVISO_PUNTO_GPS.sinPunto:
      return <Ionicons name="alert-circle" size={AVISO_PUNTO_GPS_ICON_SIZE} color={colors.gpsNone} />;
  }
}

/** Debajo de la fila de "Sin foto"/cerrar: no la pisa aunque el texto crezca. */
export default function AvisoPuntoGps({ aviso }: { aviso: Aviso | null }) {
  const insets = useSafeAreaInsets();
  if (!aviso) return null;
  const top = insets.top + spacing.xl + touchTarget.min + spacing.md;
  return (
    <View testID="aviso-punto-gps" style={[styles.container, { top }]} pointerEvents="none">
      <IconoDelAviso aviso={aviso} />
      <Text style={styles.text}>{textoDelAviso(aviso)}</Text>
    </View>
  );
}
