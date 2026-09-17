import { Modal, View } from 'react-native';
import ModalHeader from './ModalHeader';
import KeyboardAwareFormBody from './KeyboardAwareFormBody';
import { entityFormModalStyles as styles } from './EntityFormModal.styles';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Botonera de acciones (footer fijo). */
  footer: React.ReactNode;
  children: React.ReactNode;
  /** Modales hermanos (p.ej. ConfirmModal) que deben vivir dentro del Modal. */
  extraContent?: React.ReactNode;
}

/**
 * Template full-screen para creación/edición de entidades (#89): header verde
 * con safe-area, cuerpo keyboard-aware y footer fijo. El back del SO cierra
 * el modal vía onRequestClose.
 */
export default function EntityFormModal({ visible, title, onClose, footer, children, extraContent }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.safeContainer}>
        <ModalHeader title={title} onClose={onClose} />
        <KeyboardAwareFormBody footer={footer}>{children}</KeyboardAwareFormBody>
      </View>
      {extraContent}
    </Modal>
  );
}
