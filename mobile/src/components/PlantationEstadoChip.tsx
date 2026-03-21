import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../theme';

type Props = {
  estado: string;
};

const CHIP_CONFIG: Record<string, { label: string; color: string }> = {
  activa: { label: 'Activa', color: colors.stateActiva },
  finalizada: { label: 'Finalizada', color: colors.stateFinalizada },
  sincronizada: { label: 'Sincronizada', color: colors.stateSincronizada },
};

export default function PlantationEstadoChip({ estado }: Props) {
  const config = CHIP_CONFIG[estado] ?? { label: estado, color: colors.textMuted };

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: config.color + '22', borderColor: config.color },
      ]}
    >
      <Text style={[styles.chipText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: borderRadius.round,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
