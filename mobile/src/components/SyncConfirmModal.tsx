import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import BaseModal from './BaseModal';
import CheckboxRow from './CheckboxRow';
import { useSyncSetting } from '../hooks/useSyncSetting';

type Props = {
  visible: boolean;
  title?: string;
  onConfirm: (incluirFotos: boolean) => void;
  onClose: () => void;
};

export default function SyncConfirmModal({ visible, title = 'Sincronizar', onConfirm, onClose }: Props) {
  const { incluirFotos, toggleIncluirFotos } = useSyncSetting();

  function handleConfirm() {
    onConfirm(incluirFotos);
  }

  return (
    <BaseModal visible={visible} onRequestClose={onClose} dismissOnBackdrop>
      <Ionicons name="sync-outline" size={28} color={colors.primary} />
      <Text style={styles.title}>{title}</Text>
      <View style={styles.checkboxContainer}>
        <CheckboxRow
          label="Incluir fotos"
          checked={incluirFotos}
          onToggle={() => toggleIncluirFotos(!incluirFotos)}

        />
      </View>
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed]}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmBtnText}>Sincronizar</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          onPress={onClose}
        >
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    color: colors.text,
    textAlign: 'center',
  },
  checkboxContainer: {
    width: '100%',
    paddingVertical: spacing.md,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.md,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  confirmBtnPressed: {
    opacity: 0.8,
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
  cancelBtn: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnPressed: {
    opacity: 0.8,
  },
  cancelBtnText: {
    color: colors.textMuted,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
