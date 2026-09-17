/** Barra de avance de los modales de sync y de descarga de catálogo. */
import { View } from 'react-native';
import { progressBarStyles as styles } from './ProgressBar.styles';

export default function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <View testID="progress-bar" style={styles.track}>
      <View testID="progress-bar-fill" style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}
