import { View, Text, ActivityIndicator } from 'react-native';
import { spinnerStyles as styles } from './Spinner.styles';
import { colors } from '../theme';

/**
 * Spinner — indicador global de "transacción en progreso" (círculo que gira).
 * Reutilizable: modal de generación de IDs, modal de sync de grupos, etc.
 */
export default function Spinner({
  label,
  size = 'small',
  color = colors.primary,
}: {
  label?: string;
  size?: 'small' | 'large';
  color?: string;
}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}
