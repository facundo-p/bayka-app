// Estilos de PlantationDetailHeader.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const plantationDetailHeaderStyles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  finalizadaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stateFinalizada + '66',
  },
  finalizadaBannerText: { flex: 1, fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.stateFinalizada },
});
