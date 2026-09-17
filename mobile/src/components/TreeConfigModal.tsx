import { Modal, View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { treeConfigModalStyles as styles } from './TreeConfigModal.styles';

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
