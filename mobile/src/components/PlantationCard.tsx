/**
 * PlantationCard — displays a plantation with stats in the plantaciones list.
 * Used by PlantacionesScreen for both admin and tecnico roles.
 */
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius } from '../theme';
import TreeIcon from './TreeIcon';

type Props = {
  lugar: string;
  periodo: string;
  totalCount: number;
  syncedCount: number;
  todayCount: number;
  pendingSync: number;
  estado?: string;
  onPress: () => void;
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
}: Props) {
  const accentColor =
    estado === 'finalizada'
      ? colors.stateFinalizada
      : estado === 'sincronizada'
        ? colors.stateSincronizada
        : colors.primary;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderLeftWidth: 3, borderLeftColor: accentColor },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.cardInner}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle}>{lugar}</Text>
            <Text style={styles.cardSubtitle}>{periodo}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <TreeIcon size={11} />
            <Text style={[styles.statValue, { color: colors.statTotal }]}>{totalCount}</Text>
            <Text style={styles.statLabel}>total</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="cloud-done-outline" size={12} color={colors.statSynced} />
            <Text style={[styles.statValue, { color: colors.statSynced }]}>{syncedCount}</Text>
            <Text style={styles.statLabel}>sincronizados</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="today-outline" size={12} color={colors.statToday} />
            <Text style={[styles.statValue, { color: colors.statToday }]}>{todayCount}</Text>
            <Text style={styles.statLabel}>hoy</Text>
          </View>
        </View>

        {/* Pending sync banner */}
        {pendingSync > 0 && (
          <View style={styles.pendingSyncRow}>
            <Ionicons name="cloud-upload-outline" size={14} color={colors.secondary} />
            <Text style={styles.pendingSyncText}>
              {pendingSync} subgrupo{pendingSync > 1 ? 's' : ''} finalizado{pendingSync > 1 ? 's' : ''} pendiente{pendingSync > 1 ? 's' : ''} de sincronizar
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardPressed: { transform: [{ scale: 0.98 }] },
  cardInner: { padding: spacing.xl },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitleArea: { flex: 1, marginRight: spacing.md },
  cardTitle: { fontSize: fontSize.xxl, fontWeight: 'bold', color: colors.text, marginBottom: 2 },
  cardSubtitle: { fontSize: fontSize.base, color: colors.textFaint },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  statValue: { fontSize: fontSize.base, fontWeight: 'bold' },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  pendingSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pendingSyncText: { fontSize: fontSize.sm, color: colors.secondary, fontWeight: '600' },
});
