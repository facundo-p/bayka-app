import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { GroupTipo } from '../repositories/GroupRepository';
import { GROUP_TIPO, GROUP_TIPO_LABELS } from '../constants/groupTipo';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  value: GroupTipo;
  onChange: (tipo: GroupTipo) => void;
}

export default function TipoSegmentedControl({ value, onChange }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.segmentedControl}>
        {Object.values(GROUP_TIPO).map((tipo) => (
          <Pressable
            key={tipo}
            style={[styles.segmentButton, value === tipo && styles.segmentButtonActive]}
            onPress={() => onChange(tipo)}
          >
            <Text style={[styles.segmentLabel, value === tipo && styles.segmentLabelActive]}>
              {GROUP_TIPO_LABELS[tipo]}
            </Text>
          </Pressable>
        ))}
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
    fontFamily: fonts.semiBold,
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
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  segmentLabelActive: {
    color: colors.white,
  },
});
