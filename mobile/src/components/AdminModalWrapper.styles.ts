// Estilos de AdminModalWrapper.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const adminModalWrapperStyles = StyleSheet.create({
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
