/**
 * PlantationCard — displays a plantation with stats in the plantaciones list.
 * Used by PlantacionesScreen for both admin and tecnico roles.
 *
 * Includes an inline expandable section with the parcelas list as a shortcut.
 * The expand row uses `stopPropagation` so tapping the chevron does NOT
 * trigger the card's main `onPress`. Animation via `LayoutAnimation` is
 * driven by the parent (PlantacionesScreen calls `LayoutAnimation.configureNext`
 * before flipping `expanded`).
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, iconSizes } from '../theme';
import React from 'react';
import OrangeDot from './OrangeDot';
import ParcelaRow from './ParcelaRow';
import { plantationCardStyles as styles } from './PlantationCard.styles';
import type { ParcelaWithStats } from '../queries/parcelaQueries';

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
  /** Long-press de la card: abre la edición (patrón de las demás cards, #94). */
  onLongPress?: () => void;
  onDelete?: () => void;
  nnCount?: number;
  // Role-aware action slots
  isAdmin?: boolean;
  /** Sync de ESTA plantación desde la card (#94); ausente = slot vacío (offline). */
  onSync?: () => void;
  onGear?: () => void;
  // Visibilidad configurada desde la web; el badge "Oculta en app" solo lo ve
  // el admin (los técnicos directamente no reciben plantaciones ocultas).
  visibleInApp?: boolean;
  // Inline expansion props (all optional; expand row only renders when
  // `onToggleExpanded` is supplied by the parent wrapper).
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
  onSync,
  onGear,
  onDelete,
}: {
  onSync?: () => void;
  onGear?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.strip}>
      {/* Cada acción ausente deja un slot vacío para que el layout no salte
          entre cards (sync se oculta offline; gear es admin-only). */}
      {onSync ? (
        <Pressable
          onPress={(e) => { e?.stopPropagation?.(); onSync(); }}
          hitSlop={8}
          style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
          accessibilityLabel="Sincronizar plantacion"
        >
          <Ionicons name="sync-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.stripSlot} />
      )}
      {onGear ? (
        <Pressable
          onPress={(e) => { e?.stopPropagation?.(); onGear(); }}
          hitSlop={8}
          style={({ pressed }) => [styles.stripSlot, pressed && { opacity: 0.5 }]}
          accessibilityLabel="Acciones de plantacion"
        >
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.stripSlot} />
      )}
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
  onLongPress,
  onDelete,
  isAdmin = false,
  onSync,
  onGear,
  visibleInApp = true,
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
      onLongPress={onLongPress}
    >
      {/* Fila superior: franja verde + contenido + acciones. La franja y los
          íconos de acción solo cubren esta fila; la expansión de parcelas va
          debajo (full-width), así los íconos no se desplazan al expandir. */}
      <View style={styles.topRow}>
        <View style={[styles.sidebar, { backgroundColor: accentColor }]}>
          <MaterialCommunityIcons name="leaf" size={24} color={colors.white} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            {hasPendingSync && <OrangeDot size={10} style={styles.titleDot} />}
            <Text style={styles.title} numberOfLines={1}>{lugar}</Text>
          </View>
          <Text style={styles.subtitle}>{periodo}</Text>

          {isAdmin && !visibleInApp && (
            <View style={styles.hiddenBadge}>
              <Ionicons name="eye-off-outline" size={iconSizes.badge} color={colors.textMuted} />
              <Text style={styles.hiddenBadgeText}>Oculta en app</Text>
            </View>
          )}

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
        </View>

        <ActionStrip onSync={onSync} onGear={onGear} onDelete={onDelete} />
      </View>

      {onToggleExpanded && (
        <View style={styles.parcelasSection}>
          <ExpandRow
            parcelasCount={parcelasCount}
            expanded={expanded}
            onToggle={onToggleExpanded}
          />

          {expanded && parcelas && (
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(120)}
            >
              <ExpandedSection
                parcelas={parcelas}
                onParcelaPress={onParcelaPress}
                onParcelaLongPress={onParcelaLongPress}
              />
            </Animated.View>
          )}
        </View>
      )}
    </Pressable>
  );
}
