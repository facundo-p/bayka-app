// Estilos de PlantationDetailScreen.
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

export const plantationDetailScreenStyles = StyleSheet.create({
  listContent: { padding: spacing.xxl, paddingBottom: spacing.xl, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl, borderWidth: 1, borderColor: colors.border },
  cardOtherUser: { backgroundColor: colors.otherUserBg, opacity: 0.55 },
  cardReadOnly: { opacity: 0.75 },
  cardPressed: { opacity: 0.7 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardName: { fontSize: fontSize.xl, fontFamily: fonts.heading, color: colors.text, flex: 1 },
  cardNameOther: { color: colors.textMuted, fontFamily: fonts.medium },
  cardCreator: { fontSize: fontSize.xs, fontFamily: fonts.regular, color: colors.textMuted, marginTop: spacing.xs },
  treeCountText: { fontSize: fontSize.base, color: colors.plantation, fontFamily: fonts.semiBold },
  deleteCardButton: { padding: 2 },
  pendingSyncDot: { marginLeft: spacing.xs },
  nnBadge: { backgroundColor: colors.secondaryYellowLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.secondaryYellowMedium },
  nnBadgeText: { color: colors.secondaryYellowDark, fontSize: fontSize.xs, fontFamily: fonts.bold },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: fontSize.xl, color: colors.textSecondary, fontFamily: fonts.semiBold },
  emptySubtext: { fontSize: fontSize.base, color: colors.textMuted, marginTop: spacing.sm, fontFamily: fonts.regular },
  editModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  editModalDismiss: { flex: 1 },
  editModalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.round, borderTopRightRadius: borderRadius.round, padding: spacing.xxxl, paddingBottom: spacing['6xl'] },
  editModalTitle: { fontSize: fontSize.title, fontFamily: fonts.heading, color: colors.text, marginBottom: spacing.xxxl },
});
