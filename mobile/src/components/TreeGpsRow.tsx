import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { getAccuracyLevel } from '../services/gps/signalLevel';
import { colors } from '../theme';
import { formatGpsAccuracy } from '../utils/gpsAccuracyFormat';
import GpsSignalIndicator, { type GpsSignalState } from './GpsSignalIndicator';
import { GPS_LEVEL_COLOR } from './gpsLevelColors';
import { TREE_GPS_BUTTON_HIT_SLOP, treeGpsRowStyles as styles } from './TreeGpsRow.styles';

export interface TreeGpsPoint {
  hasPoint: boolean;
  /** null con punto = el provider no informó la precisión. */
  gpsAccuracy: number | null;
}

interface Props {
  signal: GpsSignalState;
  /** Árbol seleccionado; null = grupo vacío: no hay botón y la row conserva el alto. */
  tree: TreeGpsPoint | null;
  /** La captura en curso es la de este árbol. */
  capturing: boolean;
  /** Hay una captura en curso (de este u otro árbol): no se lanza otra en paralelo. */
  disabled: boolean;
  onCapture: () => void;
}

/**
 * Row bajo la tira de árboles: señal GPS del teléfono a la izquierda y captura del
 * punto del árbol seleccionado a la derecha. El botón crece desde el borde derecho,
 * así la leyenda y el semáforo nunca se mueven.
 */
export default function TreeGpsRow({ signal, tree, capturing, disabled, onCapture }: Props) {
  return (
    <View testID="tree-gps-row" style={styles.container}>
      <View style={styles.current}>
        <Text style={styles.currentLabel}>Precisión actual</Text>
        <GpsSignalIndicator
          lastFix={signal.lastFix}
          permissionStatus={signal.permissionStatus}
          servicesEnabled={signal.servicesEnabled}
          compact
        />
      </View>
      {tree && (
        <Pressable
          testID="capture-gps-button"
          style={styles.button}
          onPress={onCapture}
          disabled={disabled}
          hitSlop={TREE_GPS_BUTTON_HIT_SLOP}
        >
          <CaptureLead tree={tree} capturing={capturing} />
          <Text style={styles.buttonText}>{tree.hasPoint ? 'Recapturar' : 'Capturar'}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Spinner mientras captura; con punto, su precisión; sin punto, la mira. */
function CaptureLead({ tree, capturing }: { tree: TreeGpsPoint; capturing: boolean }) {
  if (capturing) {
    return <ActivityIndicator testID="capture-gps-spinner" size="small" color={colors.plantation} />;
  }
  if (!tree.hasPoint) {
    return <Ionicons testID="capture-gps-crosshair" name="locate-outline" size={14} color={colors.plantation} />;
  }
  const color = tree.gpsAccuracy === null
    ? colors.gpsNone
    : GPS_LEVEL_COLOR[getAccuracyLevel(tree.gpsAccuracy)];
  return (
    <Text testID="tree-gps-accuracy" style={[styles.accuracyText, { color }]}>
      {formatGpsAccuracy(tree.gpsAccuracy)}
    </Text>
  );
}
