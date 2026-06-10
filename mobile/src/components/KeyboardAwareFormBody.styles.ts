import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export const keyboardAwareFormBodyStyles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.xxxl,
    paddingBottom: spacing['6xl'],
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xl,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
