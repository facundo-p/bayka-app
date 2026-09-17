/**
 * PlantationDetailHeader — fixed top section for PlantationDetailScreen.
 * Renders the finalizada/archivada banner and filter cards.
 * (El banner de N/N vive ahora a nivel de plantación, en ParcelasScreen.)
 */
import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import FilterCards, { type FilterConfig } from './FilterCards';
import { colors, spacing } from '../theme';
import { plantationDetailHeaderStyles as styles } from './PlantationDetailHeader.styles';

type Props = {
  estadoLoaded: boolean;
  isFinalizada: boolean;
  isArchivada: boolean;
  groupFilter: string | null;
  groupFilterConfigs: FilterConfig[];
  onToggleFilter: (key: string) => void;
};

function ArchivadaBanner() {
  return (
    <View style={styles.archivadaBanner}>
      <Ionicons name="archive" size={16} color={colors.stateArchivada} />
      <View style={styles.archivadaBannerBody}>
        <Text style={styles.archivadaBannerTitle}>Plantacion archivada</Text>
        <Text style={styles.archivadaBannerText}>
          Solo lectura. Lo que quedó sin subir sigue guardado en el dispositivo hasta que un administrador la desarchive.
        </Text>
      </View>
    </View>
  );
}

function FinalizadaBanner() {
  return (
    <View style={styles.finalizadaBanner}>
      <Ionicons name="lock-closed" size={16} color={colors.stateFinalizada} />
      <Text style={styles.finalizadaBannerText}>Plantacion finalizada</Text>
    </View>
  );
}

export default function PlantationDetailHeader({
  estadoLoaded,
  isFinalizada,
  isArchivada,
  groupFilter,
  groupFilterConfigs,
  onToggleFilter,
}: Props) {
  return (
    <View style={styles.fixedHeader}>
      {/* Archivada tapa a finalizada: es lo primero que hay que resolver. */}
      {estadoLoaded && isArchivada && <ArchivadaBanner />}
      {estadoLoaded && !isArchivada && isFinalizada && <FinalizadaBanner />}

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
