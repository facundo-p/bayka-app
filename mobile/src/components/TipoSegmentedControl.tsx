import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { SubGroupTipo } from '../repositories/SubGroupRepository';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface Props {
  value: SubGroupTipo;
  onChange: (tipo: SubGroupTipo) => void;
}

export default function TipoSegmentedControl({ value, onChange }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, value === 'linea' && styles.segmentButtonActive]}
          onPress={() => onChange('linea')}
        >
          <Text style={[styles.segmentLabel, value === 'linea' && styles.segmentLabelActive]}>
            Línea
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, value === 'parcela' && styles.segmentButtonActive]}
          onPress={() => onChange('parcela')}
        >
          <Text style={[styles.segmentLabel, value === 'parcela' && styles.segmentLabelActive]}>
            Parcela
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.xxxl,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.textMedium,
    marginBottom: spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.primary,
  },
  segmentLabelActive: {
    color: colors.white,
  },
});
