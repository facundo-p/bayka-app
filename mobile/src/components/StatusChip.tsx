import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

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

const styles = StyleSheet.create({
  chip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
  },
  textSm: {
    fontSize: fontSize.xs,
  },
  textMd: {
    fontSize: fontSize.sm,
  },
});
