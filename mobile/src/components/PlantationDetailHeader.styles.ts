// Estilos de PlantationDetailHeader.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

const banner = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.md,
  borderRadius: borderRadius.lg,
  paddingVertical: spacing.lg,
  paddingHorizontal: spacing.xxl,
  marginBottom: spacing.sm,
  borderWidth: 1,
} as const;

export const plantationDetailHeaderStyles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  finalizadaBanner: {
    ...banner,
    backgroundColor: colors.secondaryBg,
    borderColor: colors.stateFinalizada + '66',
  },
  finalizadaBannerText: { flex: 1, fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.stateFinalizada },
  archivadaBanner: {
    ...banner,
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.stateArchivada + '66',
  },
  eliminadaBanner: {
    ...banner,
    backgroundColor: colors.dangerBg,
    borderColor: colors.stateEliminada + '66',
  },
  eliminadaBannerTitle: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.stateEliminada },
  archivadaBannerBody: { flex: 1, gap: spacing.xs },
  archivadaBannerTitle: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.stateArchivada },
  archivadaBannerText: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textSecondary },
});
