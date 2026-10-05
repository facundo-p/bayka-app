// Estilos de TamanoBotoneraSection.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const TAMANO_ICONO_RESTABLECER = 16;

export const tamanoBotoneraSectionStyles = StyleSheet.create({
  // Sobre el estilo de fila de Opciones: los controles van uno debajo del otro.
  seccion: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xl },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxl },
  vistaPreviaTitulo: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textMuted },
  vistaPrevia: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    // Es una muestra: tocarla no carga nada ni vibra.
    pointerEvents: 'none',
  },
  restablecer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  restablecerTexto: { fontSize: fontSize.md, fontFamily: fonts.medium, color: colors.plantationDark },
  restablecerTextoDeshabilitado: { color: colors.textMuted },
});
