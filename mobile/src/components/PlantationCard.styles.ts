/**
 * Styles for PlantationCard.
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, chipSizes } from '../theme';

const SIDEBAR_WIDTH = 48;

export const plantationCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'column',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: colors.surface,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },

  // Fila superior: franja + contenido + acciones (la franja verde y los íconos
  // solo cubren esta fila; el desplegable de parcelas va debajo, full-width).
  topRow: {
    flexDirection: 'row',
  },

  // Left colored strip — stretches to the top row height only.
  sidebar: {
    width: SIDEBAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleDot: {
    marginRight: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.textHeading,
    marginBottom: 2,
    flex: 1,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  // Chip "Oculta en app" — solo admin, plantación con visible_in_app=false.
  hiddenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: borderRadius.full,
    ...chipSizes.sm,
    marginBottom: spacing.lg,
  },
  hiddenBadgeText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.textMuted,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },

  pendingSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pendingSyncText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },

  // Sección de parcelas — full-width, debajo de la fila superior. Su propio
  // padding horizontal reemplaza el de `content` (ya no está encajonada entre
  // las dos franjas laterales).
  parcelasSection: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  // Expand row — "Parcelas: N" + chevron
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44, // touch target
  },
  expandRowPressed: {
    opacity: 0.6,
  },
  expandLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  expandedSection: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xs,
  },
  expandedEmptyText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    fontStyle: 'italic',
  },

  // Right sidebar strip — 3 action slots. Anclados arriba (flex-start) para que
  // NO se desplacen al expandir parcelas (antes 'center' los recentraba al
  // crecer la card). El padding superior los alinea con el título.
  strip: {
    backgroundColor: colors.surface,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: SIDEBAR_WIDTH,
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  stripSlot: {
    height: 36,
    width: SIDEBAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const PLANTATION_CARD_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
