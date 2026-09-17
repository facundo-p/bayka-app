import { Dimensions, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
export const STRIP_PADDING = spacing.md;
const CHIP_GAP = spacing.sm;
/** Hasta 3 árboles la tira se completa con lugares vacíos. */
export const MIN_VISIBLE_SLOTS = 3;
/** 3 chips enteros y un pedazo del anterior, para que se note que la tira se desliza. */
const VISIBLE_CHIPS = 3.3;
const CHIP_WIDTH = (SCREEN_WIDTH - STRIP_PADDING - CHIP_GAP * MIN_VISIBLE_SLOTS) / VISIBLE_CHIPS;
export const CHIP_STRIDE = CHIP_WIDTH + CHIP_GAP;
/** Alto fijo: el chip seleccionado (borde doble, texto que se achica) no cambia el alto de la tira. */
const CHIP_HEIGHT = 44;
/** Posición de 3 cifras en pantalla angosta: el texto se achica en vez de partirse. */
export const CHIP_TEXT_MIN_SCALE = 0.7;
export const CHIP_DELETE_HIT_SLOP = spacing.md;

export const treeStripStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  // El gap va como margen derecho de cada chip; el padding final lo descuenta.
  listContent: {
    paddingLeft: STRIP_PADDING,
    paddingRight: STRIP_PADDING - CHIP_GAP,
  },
  footer: {
    paddingHorizontal: STRIP_PADDING,
  },
  emptySlots: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.recentBg,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    height: CHIP_HEIGHT,
    borderWidth: 1,
    borderColor: colors.recentBorder,
    gap: spacing.xs,
    width: CHIP_WIDTH,
    marginRight: CHIP_GAP,
  },
  chipEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: colors.recentBgActive,
    borderColor: colors.recentText,
    borderWidth: 2,
  },
  chipText: {
    flexShrink: 1,
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.recentText,
  },
  chipTextSelected: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
  },
  deleteButton: {
    padding: spacing.xs,
  },
});
