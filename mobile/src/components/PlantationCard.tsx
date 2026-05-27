/**
 * PlantationCard — displays a plantation with stats in the plantaciones list.
 * Used by PlantacionesScreen for both admin and tecnico roles.
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';
import React from 'react';
import OrangeDot from './OrangeDot';
import { plantationCardStyles as styles } from './PlantationCard.styles';

type Props = {
  lugar: string;
  periodo: string;
  totalCount: number;
  syncedCount: number;
  todayCount: number;
  pendingSync: number;
  estado?: string;
  hasPendingSync?: boolean;
  onPress: () => void;
  onDelete?: () => void;
  nnCount?: number;
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
  hasPendingSync = false,
  nnCount,
  onPress,
  onDelete,
  isAdmin,
  onEdit,
  onGear,
}: Props) {
  const accentColor =
    estado === 'finalizada'
      ? colors.stateFinalizada
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
        <View style={styles.titleRow}>
          {hasPendingSync && <OrangeDot size={10} style={styles.titleDot} />}
          <Text style={styles.title} numberOfLines={1}>{lugar}</Text>
        </View>
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
          {estado !== 'finalizada' && (
            <View style={styles.statItem}>
              <Ionicons name="today-outline" size={14} color={colors.statToday} />
              <Text style={[styles.statValue, { color: colors.statToday }]}>{todayCount}</Text>
            </View>
          )}
          {(nnCount ?? 0) > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="help-circle-outline" size={14} color={colors.secondaryYellowDark} />
              <Text style={[styles.statValue, { color: colors.secondaryYellowDark }]}>{nnCount}</Text>
            </View>
          )}
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

        {/* Slot 2: Gear (middle) — visible for all users */}
        <Pressable
          onPress={(e) => { e?.stopPropagation?.(); onGear?.(); }}
          hitSlop={8}
          style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
          accessibilityLabel="Acciones de plantacion"
        >
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
        </Pressable>

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

