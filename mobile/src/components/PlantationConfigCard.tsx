import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { checkFinalizationGate, hasIdsGenerated } from '../queries/adminQueries';
import PlantationEstadoChip from './PlantationEstadoChip';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Plantation = {
  id: string;
  lugar: string;
  periodo: string;
  estado: string;
  createdAt: string;
  pendingSync?: boolean;  // true for offline-created, not yet uploaded
  pendingEdit?: boolean;  // true for offline-edited lugar/periodo, not yet uploaded
};

type Props = {
  item: Plantation;
  onFinalize: (id: string) => void;
  onGenerateIds: (id: string) => void;
  onExportCsv: (id: string) => void;
  onExportExcel: (id: string) => void;
  onConfigSpecies: (id: string) => void;
  onAssignTech: (id: string) => void;
  onEdit: (item: Plantation) => void;
};

export default function PlantationConfigCard({
  item,
  onFinalize,
  onGenerateIds,
  onExportCsv,
  onExportExcel,
  onConfigSpecies,
  onAssignTech,
  onEdit,
}: Props) {
  const [idsGenerated, setIdsGenerated] = useState(false);
  const [canFinalize, setCanFinalize] = useState(false);

  useEffect(() => {
    if (item.estado === 'finalizada') {
      hasIdsGenerated(item.id).then(setIdsGenerated).catch(console.error);
    }
    if (item.estado === 'activa') {
      checkFinalizationGate(item.id)
        .then((gate) => setCanFinalize(gate.canFinalize))
        .catch(console.error);
    }
  }, [item.id, item.estado]);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle}>{item.lugar}</Text>
          <Text style={styles.cardSubtitle}>{item.periodo}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          {item.pendingSync === true && (
            <View style={styles.pendingSyncBadge}>
              <Ionicons name="cloud-upload-outline" size={11} color={colors.white} />
              <Text style={styles.pendingSyncText}>Pendiente de sync</Text>
            </View>
          )}
          {item.estado === 'activa' && (
            <Pressable
              style={({ pressed }) => [styles.editIconBtn, pressed && { opacity: 0.7 }]}
              onPress={() => onEdit(item)}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </Pressable>
          )}
          <PlantationEstadoChip estado={item.estado} />
        </View>
      </View>

      {item.estado === 'activa' && (
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onConfigSpecies(item.id)}
          >
            <Ionicons name="list-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Configurar especies</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnSecondary,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => onAssignTech(item.id)}
          >
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnSecondaryText}>Asignar técnicos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionBtnDanger,
              pressed && { opacity: 0.7 },
              !canFinalize && styles.actionBtnDisabled,
            ]}
            onPress={() => onFinalize(item.id)}
            disabled={!canFinalize}
          >
            <Ionicons name="lock-closed-outline" size={14} color={colors.white} />
            <Text style={styles.actionBtnDangerText}>Finalizar</Text>
          </Pressable>
        </View>
      )}

      {item.estado === 'finalizada' && (
        <View style={styles.actionRow}>
          {!idsGenerated && (
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => onGenerateIds(item.id)}
            >
              <Ionicons name="key-outline" size={14} color={colors.white} />
              <Text style={styles.actionBtnPrimaryText}>Generar IDs</Text>
            </Pressable>
          )}
          {idsGenerated && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onExportCsv(item.id)}
              >
                <Ionicons name="document-text-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar CSV</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => onExportExcel(item.id)}
              >
                <Ionicons name="grid-outline" size={14} color={colors.primary} />
                <Text style={styles.actionBtnSecondaryText}>Exportar Excel</Text>
              </Pressable>
            </>
          )}
          <View style={styles.lockedBadge}>
            <Ionicons name="lock-closed" size={12} color={colors.stateFinalizada} />
            <Text style={styles.lockedText}>Bloqueada</Text>
          </View>
        </View>
      )}
    </View>
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
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleArea: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  editIconBtn: {
    padding: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.base,
    fontFamily: fonts.regular,
    color: colors.textFaint,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnPrimaryText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  actionBtnSecondary: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  actionBtnSecondaryText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  actionBtnDanger: {
    backgroundColor: colors.danger,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnDangerText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
  },
  lockedText: {
    color: colors.stateFinalizada,
    fontSize: fontSize.sm,
    fontFamily: fonts.semiBold,
  },
  pendingSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.stateFinalizada,
    borderRadius: borderRadius.full,
  },
  pendingSyncText: {
    color: colors.white,
    fontSize: fontSize.xs,
    fontFamily: fonts.semiBold,
  },
});
