/**
 * PlantationCard — displays a plantation with stats in the plantaciones list.
 * Used by PlantacionesScreen for both admin and tecnico roles.
 *
 * Plan 17-02: adds an inline expandable section with the parcelas list as a
 * shortcut (D-17-10..14). The expand row uses `stopPropagation` so tapping
 * the chevron does NOT trigger the card's main `onPress` (D-17-11).
 * Animation via `LayoutAnimation` is driven by the parent (PlantacionesScreen
 * calls `LayoutAnimation.configureNext` before flipping `expanded`).
 */
import { View, Text, Pressable, Platform, UIManager } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';
import React from 'react';
import OrangeDot from './OrangeDot';
import ParcelaRow from './ParcelaRow';
import { plantationCardStyles as styles } from './PlantationCard.styles';
import type { ParcelaWithStats } from '../queries/parcelaQueries';

// D-17-14: enable LayoutAnimation on Android (project_android_only.md).
// Idempotent — RN no-ops if already enabled.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  // Plan 17-02: inline expansion (all optional; expand row only renders
  // when `onToggleExpanded` is supplied by the parent wrapper).
  parcelasCount?: number;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  parcelas?: ParcelaWithStats[];
  onParcelaPress?: (parcelaId: string) => void;
  onParcelaLongPress?: (parcela: ParcelaWithStats) => void;
};

function ExpandRow({
  parcelasCount,
  expanded,
  onToggle,
}: {
  parcelasCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={(e) => { e?.stopPropagation?.(); onToggle(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.expandRow, pressed && styles.expandRowPressed]}
      accessibilityLabel={expanded ? 'Ocultar parcelas' : 'Mostrar parcelas'}
      accessibilityRole="button"
    >
      <Ionicons name="map-outline" size={16} color={colors.textPrimary} />
      <Text style={styles.expandLabel}>Parcelas: {parcelasCount}</Text>
      <Ionicons
        name={expanded ? 'chevron-down' : 'chevron-forward'}
        size={18}
        color={colors.textPrimary}
      />
    </Pressable>
  );
}

function ExpandedSection({
  parcelas,
  onParcelaPress,
  onParcelaLongPress,
}: {
  parcelas: ParcelaWithStats[];
  onParcelaPress?: (parcelaId: string) => void;
  onParcelaLongPress?: (parcela: ParcelaWithStats) => void;
}) {
  if (parcelas.length === 0) {
    return (
      <View style={styles.expandedSection}>
        <Text style={styles.expandedEmptyText}>
          Sin parcelas — toca + en la lista de parcelas para crear una.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.expandedSection}>
      {parcelas.map((p, idx) => (
        <View key={p.id}>
          <ParcelaRow
            parcela={p}
            variant="inline"
            onPress={() => onParcelaPress?.(p.id)}
            onLongPress={() => onParcelaLongPress?.(p)}
          />
          {idx < parcelas.length - 1 && <View style={styles.expandedDivider} />}
        </View>
      ))}
    </View>
  );
}

function ActionStrip({
  onEdit,
  onGear,
  onDelete,
}: {
  onEdit?: () => void;
  onGear?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.strip}>
      <Pressable
        onPress={(e) => { e?.stopPropagation?.(); onEdit?.(); }}
        hitSlop={8}
        style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
        accessibilityLabel="Editar lugar y periodo"
      >
        <Ionicons name="create-outline" size={18} color={colors.primary} />
      </Pressable>
      <Pressable
        onPress={(e) => { e?.stopPropagation?.(); onGear?.(); }}
        hitSlop={8}
        style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
        accessibilityLabel="Acciones de plantacion"
      >
        <Ionicons name="settings-outline" size={18} color={colors.primary} />
      </Pressable>
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
  );
}

function StatsRow({
  totalCount,
  syncedCount,
  todayCount,
  nnCount,
  estado,
}: {
  totalCount: number;
  syncedCount: number;
  todayCount: number;
  nnCount?: number;
  estado?: string;
}) {
  return (
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
  );
}

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
  onEdit,
  onGear,
  parcelasCount = 0,
  expanded = false,
  onToggleExpanded,
  parcelas,
  onParcelaPress,
  onParcelaLongPress,
}: Props) {
  const accentColor =
    estado === 'finalizada' ? colors.stateFinalizada : colors.stateActiva;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.sidebar, { backgroundColor: accentColor }]}>
        <MaterialCommunityIcons name="leaf" size={24} color={colors.white} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          {hasPendingSync && <OrangeDot size={10} style={styles.titleDot} />}
          <Text style={styles.title} numberOfLines={1}>{lugar}</Text>
        </View>
        <Text style={styles.subtitle}>{periodo}</Text>

        <StatsRow
          totalCount={totalCount}
          syncedCount={syncedCount}
          todayCount={todayCount}
          nnCount={nnCount}
          estado={estado}
        />

        {pendingSync > 0 && (
          <View style={styles.pendingSyncRow}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.info} />
            <Text style={styles.pendingSyncText}>
              {pendingSync} grupo{pendingSync > 1 ? 's' : ''} listo{pendingSync > 1 ? 's' : ''} para sincronizar
            </Text>
          </View>
        )}

        {onToggleExpanded && (
          <ExpandRow
            parcelasCount={parcelasCount}
            expanded={expanded}
            onToggle={onToggleExpanded}
          />
        )}

        {expanded && parcelas && (
          <ExpandedSection
            parcelas={parcelas}
            onParcelaPress={onParcelaPress}
            onParcelaLongPress={onParcelaLongPress}
          />
        )}
      </View>

      <ActionStrip onEdit={onEdit} onGear={onGear} onDelete={onDelete} />
    </Pressable>
  );
}
