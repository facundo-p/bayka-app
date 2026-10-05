import type { ComponentProps } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import type { EstiloBotonera } from '../constants/estiloBotonera';
import type { PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import TamanoBotoneraSection from './TamanoBotoneraSection';
import { treeConfigModalStyles as styles, TAMANO_ICONO_OPCION } from './TreeConfigModal.styles';

interface Props {
  visible: boolean;
  isReadOnly: boolean;
  onClose: () => void;
  onReverseOrder: () => void;
  onReorderSpecies: () => void;
  estiloBotonera: EstiloBotonera;
  especies: readonly PlantationSpeciesItem[];
  onCambiarEstiloBotonera: (estilo: EstiloBotonera) => void;
}

export default function TreeConfigModal({
  visible,
  isReadOnly,
  onClose,
  onReverseOrder,
  onReorderSpecies,
  estiloBotonera,
  especies,
  onCambiarEstiloBotonera,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['4xl'] }]}>
            <Text style={styles.title}>Opciones</Text>
            {!isReadOnly && (
              <Opcion icono="swap-vertical-outline" color={colors.secondary} onPress={onReverseOrder}
                titulo="Invertir orden de árboles" descripcion="Invierte las posiciones y recalcula códigos" />
            )}
            <Opcion icono="grid-outline" color={colors.info} onPress={onReorderSpecies}
              titulo="Reordenar botonera" descripcion="Personaliza el orden de los botones de especies" />
            <TamanoBotoneraSection estilo={estiloBotonera} especies={especies} onChange={onCambiarEstiloBotonera} />
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cerrar</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface OpcionProps {
  icono: ComponentProps<typeof Ionicons>['name'];
  color: string;
  titulo: string;
  descripcion: string;
  onPress: () => void;
}

function Opcion({ icono, color, titulo, descripcion, onPress }: OpcionProps) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <Ionicons name={icono} size={TAMANO_ICONO_OPCION} color={color} />
      <View style={styles.optionInfo}>
        <Text style={styles.optionLabel}>{titulo}</Text>
        <Text style={styles.optionDesc}>{descripcion}</Text>
      </View>
    </Pressable>
  );
}
