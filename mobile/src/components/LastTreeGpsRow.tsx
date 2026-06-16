import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { getAccuracyLevel } from '../services/gps/signalLevel';
import { colors } from '../theme';
import { GPS_LEVEL_COLOR } from './gpsLevelColors';
import { lastTreeGpsRowStyles as styles } from './LastTreeGpsRow.styles';

interface Props {
  /** Punto del último árbol registrado; null = quedó sin coordenadas. */
  gpsAccuracy: number | null;
  hasPoint: boolean;
  recapturing: boolean;
  onRecapture: () => void;
}

/**
 * Precisión del punto del último árbol (color del semáforo) + re-captura
 * manual: el técnico espera a que la señal mejore y reemplaza el punto parado
 * junto al árbol. Si el árbol quedó sin punto (frecuencia), permite capturar
 * a demanda.
 */
export default function LastTreeGpsRow({ gpsAccuracy, hasPoint, recapturing, onRecapture }: Props) {
  const accuracyColor =
    hasPoint && gpsAccuracy !== null ? GPS_LEVEL_COLOR[getAccuracyLevel(gpsAccuracy)] : colors.gpsNone;

  return (
    <View testID="last-tree-gps-row" style={styles.container}>
      {hasPoint ? (
        <Text testID="last-tree-gps-accuracy" style={[styles.accuracyText, { color: accuracyColor }]}>
          {gpsAccuracy !== null ? `± ${Math.round(gpsAccuracy)} m` : 'precisión s/d'}
        </Text>
      ) : (
        <Text style={styles.noPointText}>Sin punto GPS</Text>
      )}
      <Pressable
        testID="recapture-gps-button"
        style={styles.button}
        onPress={onRecapture}
        disabled={recapturing}
      >
        {recapturing ? (
          <ActivityIndicator size="small" color={colors.plantation} />
        ) : (
          <Ionicons name="locate-outline" size={14} color={colors.plantation} />
        )}
        <Text style={styles.buttonText}>{hasPoint ? 'Recapturar' : 'Capturar'}</Text>
      </Pressable>
    </View>
  );
}
