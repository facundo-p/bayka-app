import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import type { ServerPlantation } from '../queries/catalogQueries';

interface Props {
  item: ServerPlantation;
  isDownloaded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export default function CatalogPlantationCard({ item, isDownloaded, isSelected, onToggle }: Props) {
  const stateColor =
    item.estado === 'activa'
      ? colors.stateActiva
      : item.estado === 'finalizada'
        ? colors.stateFinalizada
        : colors.stateSincronizada;

  const borderLeftColor = isDownloaded ? colors.stateSincronizada : stateColor;

  return (
    <Pressable
      onPress={() => onToggle(item.id)}
      style={[
        styles.card,
        { borderLeftColor, opacity: isDownloaded ? 0.65 : 1 },
      ]}
    >
      {/* Left: checkbox area */}
      <View style={styles.checkboxArea}>
        {isDownloaded ? (
          <Ionicons name="checkmark-circle" size={20} color={colors.stateSincronizada} />
        ) : isSelected ? (
          <View style={styles.checkboxSelected}>
            <Ionicons name="checkmark" size={14} color={colors.white} />
          </View>
        ) : (
          <View style={styles.checkboxEmpty} />
        )}
      </View>

      {/* Center: content */}
      <View style={styles.content}>
        <Text style={styles.cardTitle}>{item.lugar}</Text>
        <Text style={styles.cardSubtitle}>{item.periodo}</Text>

        <View style={styles.statsRow}>
          <Ionicons name="layers-outline" size={12} color={colors.statTotal} />
          <Text style={styles.statText}>{item.subgroup_count} subgrupos</Text>
          <View style={styles.statSpacer} />
          <Ionicons name="leaf-outline" size={12} color={colors.statTotal} />
          <Text style={styles.statText}>{item.tree_count} arboles</Text>
        </View>

        <View style={[styles.estadoChip, { backgroundColor: stateColor + '26' }]}>
          <Text style={[styles.estadoText, { color: stateColor }]}>{item.estado}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  checkboxArea: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxEmpty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderMuted,
  },
  content: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.textHeading,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xl,
  },
  statText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  statSpacer: {
    width: spacing.xl,
  },
  estadoChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  estadoText: {
    fontSize: fontSize.xs,
    fontFamily: fonts.regular,
  },
  deleteButton: {
    padding: spacing.sm,
  },
});
