import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, fonts } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  /** Si se omite, no se muestra la flecha de "atrás" (header raíz, p. ej.
   *  Plantaciones). Si se pasa, la flecha navega con este callback. Issue #70. */
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export default function CustomHeader({ title, subtitle, onBack, rightElement }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.headerBackButton} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.headerRight}>
        {rightElement ?? <View style={styles.headerSpacer} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    backgroundColor: colors.plantationHeaderBg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    padding: spacing.xs,
    marginRight: spacing.md,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSize.xxl,
    fontFamily: fonts.heading,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: colors.plantationCountFaded,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    marginTop: 2,
    textAlign: 'center',
  },
  headerRight: {
    marginLeft: spacing.md,
  },
  headerSpacer: {
    width: 36,
  },
});
