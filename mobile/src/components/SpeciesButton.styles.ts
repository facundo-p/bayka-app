// Estilos de SpeciesButton.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

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
  code: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.plantationDark,
  },
  codeNN: {
    color: colors.secondary,
  },
  codeSelected: {
    color: colors.white,
  },
  name: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: colors.plantationMedium,
    textAlign: 'center',
    marginTop: 2,
  },
  nameNN: {
    color: colors.secondary,
  },
  nameSelected: {
    color: colors.white,
  },
});
