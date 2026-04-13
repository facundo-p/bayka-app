/**
 * PlantationDetailHeader — fixed top section for PlantationDetailScreen.
 * Renders N/N banner, finalization banner, and filter cards.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import FilterCards from './FilterCards';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

type FilterConfig = {
  key: string;
  label: string;
  count: number;
  color: string;
  icon: string;
};

type Props = {
  blockedByNN: number;
  totalNN: number;
  estadoLoaded: boolean;
  isFinalizada: boolean;
  subgroupFilter: string | null;
  subgroupFilterConfigs: FilterConfig[];
  onResolveAllNN: () => void;
  onToggleFilter: (key: string) => void;
};

export default function PlantationDetailHeader({
  blockedByNN,
  totalNN,
  estadoLoaded,
  isFinalizada,
  subgroupFilter,
  subgroupFilterConfigs,
  onResolveAllNN,
  onToggleFilter,
}: Props) {
  return (
    <View style={styles.fixedHeader}>
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
