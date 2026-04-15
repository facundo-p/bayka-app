import { Modal, View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../theme';

type Props = {
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: 'fade' | 'slide' | 'none';
  dismissOnBackdrop?: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function BaseModal({
  visible,
  onRequestClose,
  animationType = 'fade',
  dismissOnBackdrop = false,
  cardStyle,
  overlayStyle,
  children,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose}>
      <View style={[styles.overlay, overlayStyle]}>
        {dismissOnBackdrop && onRequestClose && (
          <Pressable style={styles.backdrop} onPress={onRequestClose} />
        )}
        <View style={[styles.card, cardStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.xl,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
});
