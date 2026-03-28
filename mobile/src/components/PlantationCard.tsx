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
  syncedCount: number;
  unsyncedCount: number;
  todayCount: number;
  pendingSync: number;
  onPress: () => void;
};

export default function PlantationCard({
  lugar,
  periodo,
  syncedCount,
  unsyncedCount,
  todayCount,
  pendingSync,
  onPress,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
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
            <Text style={styles.statValue}>{syncedCount}</Text>
            <Text style={styles.statLabel}>sincronizados</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="cloud-upload-outline" size={12} color={colors.secondary} />
            <Text style={[styles.statValue, unsyncedCount > 0 && { color: colors.secondary }]}>{unsyncedCount}</Text>
            <Text style={styles.statLabel}>pendientes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="today-outline" size={12} color={colors.info} />
            <Text style={[styles.statValue, todayCount > 0 && { color: colors.info }]}>{todayCount}</Text>
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
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardPressed: { opacity: 0.7 },
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
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  statValue: { fontSize: fontSize.base, fontWeight: 'bold', color: colors.primary },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  statDivider: { width: 1, height: 16, backgroundColor: colors.border },
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
