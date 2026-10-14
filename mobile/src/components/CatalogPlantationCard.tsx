import type { ComponentProps } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { esActiva, esFinalizada } from '../constants/estados';
import type { ServerPlantation } from '../queries/catalogQueries';
import { pesoDeFotos } from '../utils/pesoDeFotosDelCatalogo';
import { catalogPlantationCardStyles as styles } from './CatalogPlantationCard.styles';

function Stat({ icon, texto }: { icon: ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={12} color={colors.statTotal} />
      <Text style={styles.statText}>{texto}</Text>
    </View>
  );
}

interface Props {
  item: ServerPlantation;
  isDownloaded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export default function CatalogPlantationCard({ item, isDownloaded, isSelected, onToggle }: Props) {
  const stateColor =
    esActiva(item)
      ? colors.stateActiva
      : esFinalizada(item)
        ? colors.stateFinalizada
        : colors.stateSincronizada;

  const borderLeftColor = isDownloaded ? colors.stateSincronizada : stateColor;
  const peso = pesoDeFotos(item);

  return (
    <Pressable
      onPress={isDownloaded ? undefined : () => onToggle(item.id)}
      disabled={isDownloaded}
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

        {/* Envuelve en vez de desbordar en pantallas angostas con los tres datos. */}
        <View style={styles.statsRow}>
          <Stat icon="layers-outline" texto={`${item.group_count} grupos`} />
          <Stat icon="leaf-outline" texto={`${item.tree_count} arboles`} />
          {peso ? <Stat icon="image-outline" texto={peso} /> : null}
        </View>

        <View style={[styles.estadoChip, { backgroundColor: stateColor + '26' }]}>
          <Text style={[styles.estadoText, { color: stateColor }]}>{item.estado}</Text>
        </View>
      </View>
    </Pressable>
  );
}
