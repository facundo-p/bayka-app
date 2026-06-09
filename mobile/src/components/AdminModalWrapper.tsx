import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, fonts } from '../theme';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function AdminModalWrapper({ title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {/* Reserva el inset inferior para los children: estos modales full-screen
          tapan la tab bar, así que sin esto el footer ("Guardar") se solapa con
          la barra del SO. Issue #73. */}
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
    backgroundColor: colors.primary,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
  },
});
