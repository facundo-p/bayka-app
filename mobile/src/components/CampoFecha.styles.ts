import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts, touchTarget } from '../theme';

// La caja conserva borde y fondo del input; el padding pasa a cada zona tocable.
export const campoFechaStyles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  valor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.button,
    paddingVertical: spacing.xl,
  },
  valorSinBorrar: {
    paddingRight: spacing.button,
  },
  texto: {
    flex: 1,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  placeholder: {
    color: colors.textLight,
  },
  borrar: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
});
