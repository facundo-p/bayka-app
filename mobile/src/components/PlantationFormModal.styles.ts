import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts, letterSpacing } from '../theme';

export const plantationFormModalStyles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  columna: {
    flex: 1,
  },
  grupoTitulo: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
    color: colors.plantationHeaderBg,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.dangerText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
