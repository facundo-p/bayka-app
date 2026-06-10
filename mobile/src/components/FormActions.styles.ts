import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const formActionsStyles = StyleSheet.create({
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.button,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: fontSize.lg,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: spacing.button,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  // Sin botón Cancelar (creación de Grupo): el submit ocupa todo el ancho.
  submitBtnFull: {
    flex: 1,
  },
  submitBtnDisabled: {
    backgroundColor: colors.primaryFaded,
  },
  submitText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
  },
});
