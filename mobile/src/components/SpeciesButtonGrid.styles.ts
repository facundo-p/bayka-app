// Estilos de SpeciesButtonGrid.
import { StyleSheet } from 'react-native';
import { spacing } from '../theme';

export const speciesButtonGridStyles = StyleSheet.create({
  grid: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  cell: { flex: 1 },
});
