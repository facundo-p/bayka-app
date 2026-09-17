import { View, Text } from 'react-native';
import { colors } from '../theme';
import { esActiva, esFinalizada } from '../constants/estados';
import { statusChipStyles as styles } from './StatusChip.styles';

interface Props {
  estado: string;
  size?: 'sm' | 'md';
}

function colorDeEstado(estado: string): string {
  if (esActiva({ estado })) return colors.stateActiva;
  if (esFinalizada({ estado })) return colors.stateFinalizada;
  return colors.textMuted;
}

export default function StatusChip({ estado, size = 'md' }: Props) {
  const config = { label: estado, color: colorDeEstado(estado) };
  const sizeStyles = size === 'sm' ? styles.sm : styles.md;

  return (
    <View
      style={[
        styles.chip,
        sizeStyles,
        {
          backgroundColor: config.color + '20',
          borderColor: config.color + '40',
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: config.color },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}
