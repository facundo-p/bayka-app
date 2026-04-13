// Centralized theme: colors, spacing, typography, and common styles.

export const colors = {
  // ─── Primary (brand dark blue) ────────────────────────────────────────────
  primary: '#0A3760',
  primaryDark: '#072847',
  primaryLight: '#1A5A8A',
  primaryMedium: '#0E4573',
  headerBg: '#0A3760',
  primaryBg: '#EDF4F9',
  primaryBgLight: '#F4F8FB',
  primaryBgMuted: '#A3C4DB',
  primaryBorder: '#C5DAE8',
  primaryFaded: '#A3C4DB',
  primaryAccent: '#3B7DB5',
  primaryCountFaded: '#C5DAE8',

  // ─── Secondary (brand olive green) ────────────────────────────────────────
  secondary: '#99B95B',
  secondaryBg: '#F6F9F0',
  secondaryBorder: '#C5D89A',

  // ─── Plantation screens (olive green accent) ──────────────────────────────
  plantation: '#99B95B',
  plantationDark: '#7A9A42',
  plantationMedium: '#8AAA4E',
  plantationLight: '#B3CF7E',
  plantationHeaderBg: '#6B8F3C',
  plantationBg: '#F6F9F0',
  plantationBgLight: '#FAFCF5',
  plantationBgMuted: '#C5D89A',
  plantationBorder: '#D4E3B0',
  plantationAccent: '#A8C465',
  plantationCountFaded: '#D4E3B0',

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
  textHeading: '#0A3760',   // brand dark blue — harmonizes with primary palette
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
  stateActiva: '#99B95B',
  stateFinalizada: '#F59E0B',
  stateSincronizada: '#0A3760',
  syncPending: '#F97316',         // orange-500 -- distinct from stateFinalizada amber

  // ─── Other user ───────────────────────────────────────────────────────────
  otherUserBg: '#F5F5F4',
  otherUserBorder: '#94A3B8',

  // ─── Semantic stat colors (consistent with estado) ──────────────────────
  statTotal: '#64748B',       // slate-500, neutral for totals
  statSynced: '#0A3760',      // brand blue — same as stateSincronizada
  statToday: '#8B5CF6',       // violet-500, unique color for "today" that doesn't clash
  statPending: '#99B95B',     // olive green — same as secondary, pending/unsync

  // ─── Connectivity ─────────────────────────────────────────────────────────
  online: '#99B95B',
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

// ─── Brand fonts ──────────────────────────────────────────────────────────────
export const fonts = {
  // Poppins — body, labels, buttons
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  // Linux Biolinum — headings, titles (brand font)
  heading: 'LinBiolinum_RB',
  headingMedium: 'LinBiolinum_R',
  headingRegular: 'LinBiolinum_R',
} as const;

// Common header style for Stack navigators
export const headerStyle = {
  headerStyle: { backgroundColor: colors.headerBg },
  headerTintColor: colors.white,
  headerTitleStyle: { fontFamily: fonts.heading },
} as const;

// Plantation header style (olive green)
export const plantationHeaderStyle = {
  headerStyle: { backgroundColor: colors.plantationHeaderBg },
  headerTintColor: colors.white,
  headerTitleStyle: { fontFamily: fonts.heading },
} as const;
