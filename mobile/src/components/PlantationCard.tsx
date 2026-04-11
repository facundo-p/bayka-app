/**
 * PlantationCard — displays a plantation with stats in the plantaciones list.
 * Used by PlantacionesScreen for both admin and tecnico roles.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import React from 'react';

const SIDEBAR_WIDTH = 48;

type Props = {
  lugar: string;
  periodo: string;
  totalCount: number;
  syncedCount: number;
  todayCount: number;
  pendingSync: number;
  estado?: string;
  onPress: () => void;
  onDelete?: () => void;
  // Role-aware action slots
  isAdmin?: boolean;
  onEdit?: () => void;
  onGear?: () => void;
};

export default function PlantationCard({
  lugar,
  periodo,
  totalCount,
  syncedCount,
  todayCount,
  pendingSync,
  estado,
  onPress,
  onDelete,
  isAdmin,
  onEdit,
  onGear,
}: Props) {
  const accentColor =
    estado === 'finalizada'
      ? colors.stateFinalizada
      : estado === 'sincronizada'
        ? colors.stateSincronizada
        : colors.stateActiva;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      {/* Colored sidebar with leaf icon */}
      <View style={[styles.sidebar, { backgroundColor: accentColor }]}>
        <MaterialCommunityIcons name="leaf" size={24} color={colors.white} />
      </View>

      {/* Content area — solid white background */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>{lugar}</Text>
        <Text style={styles.subtitle}>{periodo}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="leaf-outline" size={14} color={colors.statTotal} />
            <Text style={[styles.statValue, { color: colors.statTotal }]}>{totalCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="cloud-done-outline" size={14} color={colors.statSynced} />
            <Text style={[styles.statValue, { color: colors.statSynced }]}>{syncedCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="today-outline" size={14} color={colors.statToday} />
            <Text style={[styles.statValue, { color: colors.statToday }]}>{todayCount}</Text>
          </View>
        </View>

        {/* Pending sync banner */}
        {pendingSync > 0 && (
          <View style={styles.pendingSyncRow}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.info} />
            <Text style={styles.pendingSyncText}>
              {pendingSync} subgrupo{pendingSync > 1 ? 's' : ''} listo{pendingSync > 1 ? 's' : ''} para sincronizar
            </Text>
          </View>
        )}
      </View>

      {/* Right sidebar strip — 3 action slots */}
      <View style={styles.strip}>
        {/* Slot 1: Edit (top) — visible for both roles per D-02 */}
        <Pressable
          onPress={(e) => { e?.stopPropagation?.(); onEdit?.(); }}
          hitSlop={8}
          style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
          accessibilityLabel="Editar lugar y periodo"
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </Pressable>

        {/* Slot 2: Gear (middle) — admin only per D-03, empty placeholder for tecnico per D-04 */}
        {isAdmin ? (
          <Pressable
            onPress={(e) => { e?.stopPropagation?.(); onGear?.(); }}
            hitSlop={8}
            style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
            accessibilityLabel="Acciones de gestion"
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.stripSlot} testID="strip-slot-gear-placeholder" />
        )}

        {/* Slot 3: Trash (bottom) — existing delete behavior */}
        {onDelete ? (
          <Pressable
            onPress={(e) => { e?.stopPropagation?.(); onDelete(); }}
            hitSlop={8}
            style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
            accessibilityLabel="Eliminar plantacion del dispositivo"
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.stripSlot} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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

  title: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.textHeading,
    marginBottom: 2,
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
