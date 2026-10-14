// Estilos de StepperNumerico.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts, touchTarget } from '../theme';

const LADO_BOTON = touchTarget.min;

export const TAMANO_ICONO_STEPPER = 20;

export const stepperNumericoStyles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  textos: { flex: 1, gap: spacing.xxs },
  etiqueta: { fontSize: fontSize.base, fontFamily: fonts.medium, color: colors.text },
  descripcion: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textMuted },
  boton: {
    width: LADO_BOTON,
    height: LADO_BOTON,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonDeshabilitado: { opacity: 0.4 },
  valor: {
    minWidth: LADO_BOTON,
    textAlign: 'center',
    fontSize: fontSize.xxl,
    fontFamily: fonts.semiBold,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
});
