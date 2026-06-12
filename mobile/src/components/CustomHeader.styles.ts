import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const customHeaderStyles = StyleSheet.create({
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
    fontSize: fontSize.headerTitle,
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
