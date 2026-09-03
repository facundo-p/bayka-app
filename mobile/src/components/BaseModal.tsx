import { Modal, View, Pressable, KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { baseModalStyles as styles } from './BaseModal.styles';

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
      {/* KeyboardAvoidingView centra la card en el espacio visible: al abrir el
          teclado, la card se reposiciona hacia arriba y el botón inferior no
          queda tapado (modales centrados, issue #74). */}
      <KeyboardAvoidingView
        style={[styles.overlay, overlayStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {dismissOnBackdrop && onRequestClose && (
          <Pressable style={styles.backdrop} onPress={onRequestClose} />
        )}
        <View style={[styles.card, cardStyle]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
