// Centralized theme: colors, spacing, typography, and common styles.

export const colors = {
  primary: '#2d6a2d',
  primaryDark: '#1b5e20',
  primaryLight: '#4caf50',
  primaryMedium: '#388e3c',
  primaryBg: '#e8f5e9',
  primaryBgLight: '#f0f7f0',
  primaryBgMuted: '#a5d6a7',
  primaryBorder: '#c8e6c9',
  primaryFaded: '#a5c9a5',
  primaryAccent: '#66bb6a',
  primaryCountFaded: '#c8e6c9',

  secondary: '#e65100',
  secondaryBg: '#fff3e0',
  secondaryBorder: '#ffcc02',

  // Beige/cream for recent trees chips
  recentBg: '#f5efe6',
  recentBgActive: '#efe8db',
  recentBorder: '#ddd0be',
  recentText: '#7a6b56',

  secondaryYellow: '#ffca28',
  secondaryYellowLight: '#fff8e1',
  secondaryYellowMedium: '#ffe082',
  secondaryYellowDark: '#ffb300',

  danger: '#c62828',
  dangerLight: '#e53935',
  dangerBg: '#ffebee',
  dangerText: '#c00',

  info: '#1565c0',
  infoBg: '#e3f2fd',

  text: '#1a1a1a',
  textDark: '#222',
  textMedium: '#333',
  textSecondary: '#555',
  textMuted: '#888',
  textLight: '#aaa',
  textPlaceholder: '#999',
  textSubtle: '#777',
  textFaint: '#666',

  background: '#f5f5f5',
  backgroundAlt: '#f9f9f9',
  surface: '#fff',
  surfaceAlt: '#fafafa',
  surfacePressed: '#f0f0f0',

  border: '#e0e0e0',
  borderLight: '#ddd',
  borderMuted: '#ccc',

  white: '#fff',
  black: '#000',
  overlay: 'rgba(0,0,0,0.9)',
  disabled: '#aaa',

  // State chips
  stateActiva: '#4caf50',
  stateFinalizada: '#ff9800',
  stateSincronizada: '#2196f3',

  // Other user
  otherUserBg: '#f5f5f5',
  otherUserBorder: '#9e9e9e',

  // Connectivity state
  online: '#4caf50',
  offline: '#9e9e9e',
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
  base: 14,
  lg: 15,
  xl: 16,
  xxl: 18,
  title: 20,
  heading: 24,
  hero: 36,
} as const;

export const borderRadius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
  round: 16,
} as const;

// Common header style for Stack navigators
export const headerStyle = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: 'bold' as const },
} as const;
