import { Modal, View, Image, Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, fonts } from '../theme';

interface Props {
  visible: boolean;
  photoUri: string | null;
  onClose: () => void;
  onReplace: () => Promise<void>;
  onRemove: () => Promise<void>;
}

export default function PhotoViewerModal({ visible, photoUri, onClose, onReplace, onRemove }: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeArea} onPress={onClose}>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.photoFull} resizeMode="contain" />
          )}
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={onReplace}>
            <Ionicons name="camera-outline" size={20} color={colors.white} />
            <Text style={styles.actionText}>Reemplazar</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={onRemove}>
            <Ionicons name="trash-outline" size={20} color={colors.white} />
            <Text style={styles.actionText}>Eliminar foto</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.white} />
            <Text style={styles.actionText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  closeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFull: {
    width: '90%',
    height: '70%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingBottom: spacing['6xl'],
    paddingTop: spacing.xl,
  },
  actionBtn: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  actionBtnDanger: {
    opacity: 0.9,
  },
  actionText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
});
