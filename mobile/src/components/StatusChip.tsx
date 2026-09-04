import { View, Text } from 'react-native';
import { colors } from '../theme';
import { statusChipStyles as styles } from './StatusChip.styles';

interface Props {
  estado: string;
  size?: 'sm' | 'md';
}

const CHIP_CONFIG: Record<string, { label: string; color: string }> = {
  activa: { label: 'activa', color: colors.stateActiva },
  finalizada: { label: 'finalizada', color: colors.stateFinalizada },
};

export default function StatusChip({ estado, size = 'md' }: Props) {
  const config = CHIP_CONFIG[estado] ?? { label: estado, color: colors.textMuted };
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
