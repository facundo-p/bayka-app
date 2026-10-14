import { ScrollView, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import GpsGateBanner from './GpsGateBanner';
import SpeciesButtonGrid from './SpeciesButtonGrid';
import { colors } from '../theme';
import type { UseGpsGateResult } from '../hooks/useGpsGate';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import type { EstiloBotonera } from '../constants/estiloBotonera';
import { botoneraDeEspeciesStyles as styles } from './BotoneraDeEspecies.styles';

type Especie = { especieId: string; especieCodigo: string };

interface Props {
  gpsGate: Pick<UseGpsGateResult, 'blocked' | 'message' | 'unblocking' | 'requestUnblock'>;
  loading: boolean;
  species: PlantationSpeciesItem[];
  estilo: EstiloBotonera;
  disabled: boolean;
  onSelectSpecies: (especie: Especie) => void;
  onNNPress: () => void;
}

function GridDeEspecies({ loading, gpsGate, disabled, ...grid }: Props) {
  if (loading) return <ActivityIndicator size="large" color={colors.plantation} style={styles.loader} />;
  return (
    <Animated.View entering={FadeInDown.delay(100).duration(300)}>
      <SpeciesButtonGrid {...grid} disabled={disabled || gpsGate.blocked} />
    </Animated.View>
  );
}

/** Botones de especie del registro, con el aviso de GPS obligatorio cuando bloquea el alta. */
export default function BotoneraDeEspecies(props: Props) {
  const { gpsGate } = props;
  return (
    <>
      {gpsGate.blocked && (
        <GpsGateBanner
          message={gpsGate.message!}
          unblocking={gpsGate.unblocking}
          onRequestUnblock={gpsGate.requestUnblock}
        />
      )}
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.gridContent}>
        <GridDeEspecies {...props} />
      </ScrollView>
    </>
  );
}
