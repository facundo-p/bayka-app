/**
 * PlantationDetailHeader — fixed top section for PlantationDetailScreen.
 * Extracted to keep PlantationDetailScreen under 300 lines.
 * Renders unified Sincronizar button, N/N banner, finalization banner, and filter cards.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import FilterCards from './FilterCards';
import CheckboxRow from './CheckboxRow';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { useSyncSetting } from '../hooks/useSyncSetting';

type FilterConfig = {
  key: string;
  label: string;
  count: number;
  color: string;
  icon: string;
};

type Props = {
  isOnline: boolean;
  syncableCount: number;
  pendingPhotosCount: number;
  blockedByNN: number;
  totalNN: number;
  estadoLoaded: boolean;
  isFinalizada: boolean;
  subgroupFilter: string | null;
  subgroupFilterConfigs: FilterConfig[];
  onStartSync: (incluirFotos: boolean) => void;
  onResolveAllNN: () => void;
  onToggleFilter: (key: string) => void;
};

export default function PlantationDetailHeader({
  isOnline,
  syncableCount,
  pendingPhotosCount,
  blockedByNN,
  totalNN,
  estadoLoaded,
  isFinalizada,
  subgroupFilter,
  subgroupFilterConfigs,
  onStartSync,
  onResolveAllNN,
  onToggleFilter,
}: Props) {
  const { incluirFotos, toggleIncluirFotos } = useSyncSetting();

  return (
    <View style={styles.fixedHeader}>
      {isOnline && (
        <View style={styles.syncSection}>
          <Pressable
            testID="sync-button"
            style={({ pressed }) => [
              styles.syncButton,
              pressed && styles.syncButtonPressed,
              syncableCount === 0 && pendingPhotosCount === 0 && styles.buttonDisabled,
            ]}
            onPress={() => onStartSync(incluirFotos)}
            disabled={syncableCount === 0 && pendingPhotosCount === 0}
          >
            <Ionicons name="sync-outline" size={18} color={colors.white} />
            <Text style={styles.syncButtonText}>Sincronizar</Text>
            {(syncableCount > 0 || pendingPhotosCount > 0) && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {syncableCount > 0 ? syncableCount : pendingPhotosCount}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={styles.checkboxRow}>
            <CheckboxRow
              label="Incluir fotos"
              checked={incluirFotos}
              onToggle={() => toggleIncluirFotos(!incluirFotos)}
              accessibilityLabel="Incluir fotos en la sincronizacion"
            />
          </View>
        </View>
      )}

      {(totalNN > 0 || blockedByNN > 0) && (
        <Pressable
          style={({ pressed }) => [styles.resolveNNBanner, totalNN > 0 && pressed && { opacity: 0.8 }]}
          onPress={totalNN > 0 ? onResolveAllNN : undefined}
          disabled={totalNN === 0}
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.secondary} />
          <View style={styles.nnBannerContent}>
            {totalNN > 0 && <Text style={styles.resolveNNText}>Resolver {totalNN} N/N pendiente{totalNN > 1 ? 's' : ''}</Text>}
            {blockedByNN > 0 && <Text style={styles.nnSyncBlockedText}>{blockedByNN} subgrupo{blockedByNN > 1 ? 's' : ''} finalizado{blockedByNN > 1 ? 's' : ''} con N/N pendientes</Text>}
          </View>
          {totalNN > 0 && <Ionicons name="chevron-forward" size={16} color={colors.secondary} />}
        </Pressable>
      )}

      {estadoLoaded && isFinalizada && (
        <View style={styles.finalizadaBanner}>
          <Ionicons name="lock-closed" size={16} color={colors.stateFinalizada} />
          <Text style={styles.finalizadaBannerText}>Plantacion finalizada</Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ paddingTop: spacing.md }}>
        <FilterCards
          filters={subgroupFilterConfigs}
          activeFilter={subgroupFilter}
          onToggleFilter={onToggleFilter}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  syncSection: {
    marginBottom: spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  syncButtonPressed: {
    opacity: 0.85,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontFamily: fonts.semiBold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  countBadge: {
    backgroundColor: colors.white,
    borderRadius: 6,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeText: {
    fontSize: fontSize.xxs,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  checkboxRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  resolveNNBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  resolveNNText: { fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.secondary },
  nnBannerContent: { flex: 1 },
  nnSyncBlockedText: { fontSize: fontSize.sm, color: colors.secondary, fontFamily: fonts.medium },
  finalizadaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.secondaryBg,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stateFinalizada + '66',
  },
  finalizadaBannerText: { flex: 1, fontSize: fontSize.base, fontFamily: fonts.semiBold, color: colors.stateFinalizada },
});
