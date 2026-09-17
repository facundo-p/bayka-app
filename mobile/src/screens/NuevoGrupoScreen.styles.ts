import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const nuevoGrupoScreenStyles = StyleSheet.create({
  bloqueo: { gap: spacing.md },
  bloqueoTexto: { fontSize: fontSize.base, fontFamily: fonts.regular, color: colors.textSecondary },
});
