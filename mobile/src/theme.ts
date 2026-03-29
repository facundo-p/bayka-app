// Centralized theme: colors, spacing, typography, and common styles.

export const colors = {
  // ─── Primary (agriculture green, vibrant) ─────────────────────────────────
  primary: '#15803D',
  primaryDark: '#166534',
  primaryLight: '#22C55E',
  primaryMedium: '#16A34A',
  primaryBg: '#F0FDF4',
  primaryBgLight: '#F0FDF4',
  primaryBgMuted: '#86EFAC',
  primaryBorder: '#BBF7D0',
  primaryFaded: '#86EFAC',
  primaryAccent: '#4ADE80',
  primaryCountFaded: '#BBF7D0',

  // ─── Secondary (warm orange) ──────────────────────────────────────────────
  secondary: '#EA580C',
  secondaryBg: '#FFF7ED',
  secondaryBorder: '#FDBA74',

  // ─── Beige/cream for recent trees chips ───────────────────────────────────
  recentBg: '#f5efe6',
  recentBgActive: '#efe8db',
  recentBorder: '#ddd0be',
  recentText: '#7a6b56',

  // ─── Yellow (N/N species) ─────────────────────────────────────────────────
  secondaryYellow: '#ffca28',
  secondaryYellowLight: '#fff8e1',
  secondaryYellowMedium: '#ffe082',
  secondaryYellowDark: '#ffb300',

  // ─── Semantic ─────────────────────────────────────────────────────────────
  danger: '#DC2626',
  dangerLight: '#EF4444',
  dangerBg: '#FEF2F2',

  info: '#2563EB',
  infoBg: '#EFF6FF',

  // ─── Text (4-level hierarchy) ─────────────────────────────────────────────
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDisabled: '#CBD5E1',

  // Aliases for backward compatibility — migrate to textPrimary/Secondary/Muted/Disabled
  text: '#1E293B',
  textDark: '#1E293B',
  textMedium: '#1E293B',
  textFaint: '#475569',
  textSubtle: '#475569',
  textLight: '#94A3B8',
  textPlaceholder: '#94A3B8',
  dangerText: '#DC2626',
  disabled: '#CBD5E1',

  // ─── Surfaces ─────────────────────────────────────────────────────────────
  background: '#FAFAF9',
  backgroundAlt: '#F5F5F4',
  surface: '#FFFFFF',
  surfaceAlt: '#FAFAF9',
  surfacePressed: '#F5F5F4',

  // ─── Borders ──────────────────────────────────────────────────────────────
  border: '#E2E8F0',
  borderLight: '#E2E8F0',
  borderMuted: '#CBD5E1',

  // ─── Base ─────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.6)',

  // ─── State chips ──────────────────────────────────────────────────────────
  stateActiva: '#22C55E',
  stateFinalizada: '#F59E0B',
  stateSincronizada: '#3B82F6',

  // ─── Other user ───────────────────────────────────────────────────────────
  otherUserBg: '#F5F5F4',
  otherUserBorder: '#94A3B8',

  // ─── Semantic stat colors (consistent with estado) ──────────────────────
  statTotal: '#64748B',       // slate-500, neutral for totals
  statSynced: '#3B82F6',      // blue — same as stateSincronizada, synced = blue
  statToday: '#8B5CF6',       // violet-500, unique color for "today" that doesn't clash
  statPending: '#EA580C',     // orange — same as secondary, pending/unsync = orange

  // ─── Connectivity ─────────────────────────────────────────────────────────
  online: '#22C55E',
  offline: '#94A3B8',

} as const;

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  xxxl: 20,
  '4xl': 24,
  '5xl': 32,
  '6xl': 40,
} as const;

export const fontSize = {
  xxs: 10,
  xs: 11,
  sm: 12,
  md: 13,
  base: 15,
  lg: 15,
  xl: 16,
  xxl: 18,
  title: 20,
  heading: 24,
  hero: 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 16,
  round: 20,
  full: 9999,
} as const;

// Common header style for Stack navigators
export const headerStyle = {
  headerStyle: { backgroundColor: '#1E6B3E' },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: 'bold' as const },
} as const;
