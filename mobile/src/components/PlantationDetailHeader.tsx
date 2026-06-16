/**
 * PlantationDetailHeader — fixed top section for PlantationDetailScreen.
 * Renders finalization banner and filter cards.
 * (El banner de N/N vive ahora a nivel de plantación, en ParcelasScreen.)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  estadoLoaded: boolean;
  isFinalizada: boolean;
  groupFilter: string | null;
  groupFilterConfigs: FilterConfig[];
  onToggleFilter: (key: string) => void;
};

export default function PlantationDetailHeader({
  estadoLoaded,
  isFinalizada,
  groupFilter,
  groupFilterConfigs,
  onToggleFilter,
}: Props) {
  return (
    <View style={styles.fixedHeader}>
      {estadoLoaded && isFinalizada && (
        <View style={styles.finalizadaBanner}>
          <Ionicons name="lock-closed" size={16} color={colors.stateFinalizada} />
          <Text style={styles.finalizadaBannerText}>Plantacion finalizada</Text>
        </View>
      )}

      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ paddingTop: spacing.md }}>
        <FilterCards
          filters={groupFilterConfigs}
          activeFilter={groupFilter}
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
