import { StyleSheet } from 'react-native';
import { colors, fontSize, fonts, spacing, borderRadius } from '../theme';

/** Alto fijo: mostrar u ocultar el botón (grupo vacío) no cambia el alto de la barra. */
const ROW_HEIGHT = 30;
const BUTTON_HEIGHT = 28;
/** 28 + 8 · 2 = 44 de área táctil. */
export const TREE_GPS_BUTTON_HIT_SLOP = 8;

export const treeGpsRowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    height: ROW_HEIGHT,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currentLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    color: colors.textMuted,
  },
  accuracyText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: BUTTON_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.plantation,
  },
  buttonText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.plantation,
  },
});
