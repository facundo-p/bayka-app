import { View, Text, StyleSheet } from 'react-native';
import type { SubGroupEstado } from '../repositories/SubGroupRepository';
import { colors, fontSize, borderRadius } from '../theme';

interface Props {
  estado: SubGroupEstado;
}

const CHIP_CONFIG: Record<SubGroupEstado, { label: string; bg: string; text: string }> = {
  activa:       { label: 'Activa',       bg: colors.primaryBg,    text: colors.primary },
  finalizada:   { label: 'Finalizada',   bg: colors.secondaryBg,  text: colors.secondary },
  sincronizada: { label: 'Sincronizada', bg: colors.infoBg,       text: colors.info },
};

export default function SubGroupStateChip({ estado }: Props) {
  const config = CHIP_CONFIG[estado];
  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.xxl,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
