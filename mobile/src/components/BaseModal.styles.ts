// Estilos de BaseModal.
import { StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../theme';

export const baseModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    gap: spacing.xl,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
});
