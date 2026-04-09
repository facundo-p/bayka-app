import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  visible: boolean;
  isReadOnly: boolean;
  onClose: () => void;
  onReverseOrder: () => void;
  onReorderSpecies: () => void;
}

export default function TreeConfigModal({
  visible,
  isReadOnly,
  onClose,
  onReverseOrder,
  onReorderSpecies,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>Opciones</Text>
          {!isReadOnly && (
            <Pressable style={styles.option} onPress={onReverseOrder}>
              <Ionicons name="swap-vertical-outline" size={22} color={colors.secondary} />
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>Invertir orden de árboles</Text>
                <Text style={styles.optionDesc}>Invierte las posiciones y recalcula codigos</Text>
              </View>
            </Pressable>
          )}
          <Pressable style={styles.option} onPress={onReorderSpecies}>
            <Ionicons name="grid-outline" size={22} color={colors.info} />
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Reordenar botonera</Text>
              <Text style={styles.optionDesc}>Personaliza el orden de los botones de especies</Text>
            </View>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdrop: { flex: 1 },
  card: {
    backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.round,
    borderTopRightRadius: borderRadius.round, padding: spacing['4xl'], gap: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xxl,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    backgroundColor: colors.background, borderRadius: borderRadius.lg,
  },
  optionInfo: { flex: 1, gap: spacing.xs },
  optionLabel: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.text },
  optionDesc: { fontSize: fontSize.sm, color: colors.textMuted },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.xl, marginTop: spacing.sm },
  cancelText: { fontSize: fontSize.base, color: colors.textMuted, fontFamily: fonts.medium },
});
