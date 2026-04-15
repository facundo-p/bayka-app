import { Modal, View, Pressable, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import SpeciesReorderList from './SpeciesReorderList';
import type { ReorderItem } from './SpeciesReorderList';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  visible: boolean;
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

export default function SpeciesReorderModal({ visible, items, onReorder, onCancel, onSave }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Reordenar botonera</Text>
          <Text style={styles.hint}>Mantene presionado para arrastrar</Text>
        </View>
        <View style={{ flex: 1 }}>
          <SpeciesReorderList items={items} onReorder={onReorder} />
        </View>
        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]} onPress={onSave}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
            <Text style={styles.saveText}>Guardar</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing['4xl'], paddingBottom: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSize.xxl, fontFamily: fonts.heading, color: colors.text },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic', fontFamily: fonts.regular },
  footer: {
    flexDirection: 'row', gap: spacing.xl, padding: spacing.xxl,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { color: colors.textMuted, fontSize: fontSize.base, fontFamily: fonts.semiBold },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.xl, borderRadius: borderRadius.lg,
    backgroundColor: colors.plantationHeaderBg, gap: spacing.sm,
  },
  saveText: { color: colors.white, fontSize: fontSize.base, fontFamily: fonts.semiBold },
});
