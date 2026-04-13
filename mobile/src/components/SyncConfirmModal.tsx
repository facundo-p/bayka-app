import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import BaseModal from './BaseModal';
import CheckboxRow from './CheckboxRow';

type Props = {
  visible: boolean;
  mode: 'download' | 'upload';
  onConfirm: (incluirFotos: boolean) => void;
  onClose: () => void;
};

export default function SyncConfirmModal({ visible, mode, onConfirm, onClose }: Props) {
  const [incluirFotos, setIncluirFotos] = useState(true);

  const title = mode === 'download' ? 'Descargar datos' : 'Subir datos';
  const buttonLabel = mode === 'download' ? 'Descargar' : 'Subir';
  const icon = mode === 'download' ? 'cloud-download-outline' : 'cloud-upload-outline';

  function handleConfirm() {
    onConfirm(incluirFotos);
    setIncluirFotos(true);
  }

  function handleClose() {
    setIncluirFotos(true);
    onClose();
  }

  return (
    <BaseModal visible={visible} onRequestClose={handleClose} dismissOnBackdrop>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.checkboxContainer}>
        <CheckboxRow
          label="Incluir fotos"
          checked={incluirFotos}
          onToggle={() => setIncluirFotos(v => !v)}
        />
      </View>
      <Pressable
        style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.8 }]}
        onPress={handleConfirm}
      >
        <Text style={styles.confirmBtnText}>{buttonLabel}</Text>
      </Pressable>
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
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing['4xl'],
    width: '100%',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: colors.white,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
  },
});
