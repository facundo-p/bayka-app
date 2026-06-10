import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes, spacing } from '../theme';
import { modalHeaderStyles as styles } from './ModalHeader.styles';

interface Props {
  title: string;
  onClose: () => void;
}

/** Header verde full-screen con botón cerrar (X) y safe-area superior (#89). */
export default function ModalHeader({ title, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable style={styles.headerCloseBtn} onPress={onClose} accessibilityLabel="Cerrar" hitSlop={8}>
        <Ionicons name="close" size={iconSizes.header} color={colors.white} />
      </Pressable>
    </View>
  );
}
