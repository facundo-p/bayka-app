/**
 * Styles for PlantationCard — centralized tokens from theme.ts (CLAUDE.md §8,
 * memory `feedback_no_inline_styles.md`).
 *
 * Extracted from PlantationCard.tsx in Plan 17-02 Task 2.1 BEFORE adding
 * inline-expansion logic, so the file does not grow past the ~250 line
 * threshold. Diff vs the inline version is a pure cut+paste — no token
 * changes (Plan 17-02).
 */
import { StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

const SIDEBAR_WIDTH = 48;

export const plantationCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    backgroundColor: colors.surface,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },

  // Left colored strip
  sidebar: {
    width: SIDEBAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Main content area — solid surface color (white)
  content: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleDot: {
    marginRight: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontFamily: fonts.heading,
    color: colors.textHeading,
    marginBottom: 2,
    flex: 1,
  },
  subtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.base,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
  },

  pendingSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.infoBg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pendingSyncText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },

  // Right sidebar strip — 3 action slots
  strip: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    width: SIDEBAR_WIDTH,
    gap: spacing.md,
  },
  stripSlot: {
    height: 36,
    width: SIDEBAR_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const PLANTATION_CARD_SIDEBAR_WIDTH = SIDEBAR_WIDTH;
