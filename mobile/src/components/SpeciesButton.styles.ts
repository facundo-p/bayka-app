// Estilos de SpeciesButton.
import { StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../theme';

export const speciesButtonStyles = StyleSheet.create({
  button: {
    minHeight: 60,
    flex: 1,
    backgroundColor: colors.plantationBgLight,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.plantationBorder,
  },
  buttonPressed: {
    backgroundColor: colors.plantationBgMuted,
    borderColor: colors.plantationAccent,
  },
  buttonNN: {
    backgroundColor: colors.secondaryYellowLight,
    borderColor: colors.secondaryYellow,
  },
  buttonNNPressed: {
    backgroundColor: colors.secondaryYellowMedium,
    borderColor: colors.secondaryYellowDark,
  },
  buttonSelected: {
    backgroundColor: colors.plantation,
    borderColor: colors.plantationDark,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  // El de arriba lleva el peso visual; el de abajo acompaña. Los tamaños los elige cada usuario (#744).
  textoArriba: {
    fontFamily: fonts.bold,
    color: colors.plantationDark,
    textAlign: 'center',
  },
  textoAbajo: {
    fontFamily: fonts.regular,
    color: colors.plantationMedium,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  textoNN: {
    color: colors.secondary,
  },
  textoSelected: {
    color: colors.white,
  },
});
