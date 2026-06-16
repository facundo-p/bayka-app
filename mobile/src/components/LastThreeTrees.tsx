import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { getSpeciesCode } from '../utils/speciesHelpers';
import { lastThreeTreesStyles as styles } from './LastThreeTrees.styles';

export interface TreeChipItem {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  createdAt: string;
  grupoId: string;
  usuarioRegistro: string;
  /** Punto GPS capturado; null/ausente = árbol sin coordenadas. */
  latitude?: number | null;
  gpsAccuracy?: number | null;
}

interface Props {
  trees: TreeChipItem[];
  onUndo: () => void;
  /** Accesorio a la derecha del label (ej. semáforo de señal GPS). */
  headerAccessory?: ReactNode;
  /** Fila extra bajo los chips (ej. precisión + re-captura del último árbol). */
  footerAccessory?: ReactNode;
}

export default function LastThreeTrees({ trees, onUndo, headerAccessory, footerAccessory }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Últimos ingresados</Text>
        {headerAccessory}
      </View>
      <View style={styles.row}>
        {[0, 1, 2].map((slotIndex) => {
          const reversedTrees = [...trees].reverse();
          const tree = reversedTrees[slotIndex];
          if (!tree) {
            return <View key={`empty-${slotIndex}`} style={[styles.chip, styles.chipEmpty]} />;
          }
          const isLast = slotIndex === trees.length - 1;
          const code = getSpeciesCode(tree);
          return (
            <View key={tree.id} style={[styles.chip, isLast && styles.chipLast]}>
              {tree.latitude != null && (
                <Ionicons
                  testID={`chip-gps-pin-${tree.id}`}
                  name="location"
                  size={12}
                  color={colors.plantation}
                />
              )}
              <Text style={[styles.chipText, isLast && styles.chipTextLast]}>
                {tree.posicion} {code}
              </Text>
              {isLast && (
                <Pressable testID="undo-button" onPress={onUndo} hitSlop={8} style={styles.undoButton}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      {footerAccessory}
    </Animated.View>
  );
}
