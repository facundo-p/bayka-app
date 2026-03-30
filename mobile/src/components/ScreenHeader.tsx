/**
 * ScreenHeader — reusable header for tab screens (Plantaciones, Gestión, etc.).
 * Not for stack screens with back button — use CustomHeader for those.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  title: string;
  rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, rightElement }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Text style={styles.title}>{title}</Text>
      {rightElement && <View style={styles.right}>{rightElement}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    color: colors.primary,
    fontSize: fontSize.heading,
    fontFamily: fonts.heading,
  },
  right: {
    marginLeft: spacing.md,
  },
});
