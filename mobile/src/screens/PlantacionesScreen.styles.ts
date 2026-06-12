import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, fonts } from '../theme';

export const plantacionesScreenStyles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Barra de filtros: separada del header arriba y de las cards abajo. El
  // paddingBottom es persistente (vive fuera de la FlatList), así las cards no
  // "chocan" con los filtros al scrollear.
  filterBar: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontSize: fontSize.xxl, fontFamily: fonts.bold, color: colors.textMuted },
  emptySubtext: { fontSize: fontSize.base, color: colors.textLight, fontFamily: fonts.regular },
  // paddingTop reducido (antes 4xl) para compensar el paddingBottom de filterBar:
  // el espacio en reposo se mantiene, pero el colchón ya no se pierde al scrollear.
  listContent: { padding: spacing.xxl, paddingTop: spacing.xl, paddingBottom: spacing['6xl'], gap: spacing.xl },
});
