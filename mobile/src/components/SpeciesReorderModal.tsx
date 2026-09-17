import { Modal, View, Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import SpeciesReorderList from './SpeciesReorderList';
import type { ReorderItem } from './SpeciesReorderList';
import { colors, spacing } from '../theme';
import { speciesReorderModalStyles as styles } from './SpeciesReorderModal.styles';

interface Props {
  visible: boolean;
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

export default function SpeciesReorderModal({ visible, items, onReorder, onCancel, onSave }: Props) {
  const insets = useSafeAreaInsets();
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
        <View style={[styles.footer, { paddingBottom: spacing.xxl + insets.bottom }]}>
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
