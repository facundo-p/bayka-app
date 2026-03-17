import { View, Text, StyleSheet } from 'react-native';
import type { SubGroupEstado } from '../repositories/SubGroupRepository';

interface Props {
  estado: SubGroupEstado;
}

const CHIP_CONFIG: Record<SubGroupEstado, { label: string; bg: string; text: string }> = {
  activa:       { label: 'Activa',       bg: '#e8f5e9', text: '#2d6a2d' },
  finalizada:   { label: 'Finalizada',   bg: '#fff3e0', text: '#e65100' },
  sincronizada: { label: 'Sincronizada', bg: '#e3f2fd', text: '#1565c0' },
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
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
