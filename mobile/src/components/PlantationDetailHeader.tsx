/**
 * PlantationDetailHeader — fixed top section for PlantationDetailScreen.
 * Renders the finalizada/archivada/eliminada banner and filter cards.
 * (El banner de N/N vive ahora a nivel de plantación, en ParcelasScreen.)
 */
import React from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import FilterCards from './FilterCards';
import { colors, spacing } from '../theme';
import { plantationDetailHeaderStyles as styles } from './PlantationDetailHeader.styles';

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
  isArchivada: boolean;
  isEliminada: boolean;
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

function EliminadaBanner() {
  return (
    <View style={styles.eliminadaBanner}>
      <Ionicons name="trash" size={16} color={colors.stateEliminada} />
      <View style={styles.archivadaBannerBody}>
        <Text style={styles.eliminadaBannerTitle}>Eliminada en el servidor</Text>
        <Text style={styles.archivadaBannerText}>
          Solo lectura. Lo que quedó sin subir ya no se puede sincronizar. Podés eliminarla del dispositivo desde la lista de plantaciones.
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

/** Un solo banner: eliminada tapa a archivada y archivada a finalizada, de lo más a lo menos definitivo. */
function BannerDeEstado({ isEliminada, isArchivada, isFinalizada }: { isEliminada: boolean; isArchivada: boolean; isFinalizada: boolean }) {
  if (isEliminada) return <EliminadaBanner />;
  if (isArchivada) return <ArchivadaBanner />;
  if (isFinalizada) return <FinalizadaBanner />;
  return null;
}

export default function PlantationDetailHeader({
  estadoLoaded,
  isFinalizada,
  isArchivada,
  isEliminada,
  groupFilter,
  groupFilterConfigs,
  onToggleFilter,
}: Props) {
  return (
    <View style={styles.fixedHeader}>
      {estadoLoaded && <BannerDeEstado isEliminada={isEliminada} isArchivada={isArchivada} isFinalizada={isFinalizada} />}

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
