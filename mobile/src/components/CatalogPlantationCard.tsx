import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import type { ServerPlantation } from '../queries/catalogQueries';
import { catalogPlantationCardStyles as styles } from './CatalogPlantationCard.styles';

interface Props {
  item: ServerPlantation;
  isDownloaded: boolean;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export default function CatalogPlantationCard({ item, isDownloaded, isSelected, onToggle }: Props) {
  const stateColor =
    item.estado === 'activa'
      ? colors.stateActiva
      : item.estado === 'finalizada'
        ? colors.stateFinalizada
        : colors.stateSincronizada;

  const borderLeftColor = isDownloaded ? colors.stateSincronizada : stateColor;

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

        <View style={styles.statsRow}>
          <Ionicons name="layers-outline" size={12} color={colors.statTotal} />
          <Text style={styles.statText}>{item.group_count} grupos</Text>
          <View style={styles.statSpacer} />
          <Ionicons name="leaf-outline" size={12} color={colors.statTotal} />
          <Text style={styles.statText}>{item.tree_count} arboles</Text>
        </View>

        <View style={[styles.estadoChip, { backgroundColor: stateColor + '26' }]}>
          <Text style={[styles.estadoText, { color: stateColor }]}>{item.estado}</Text>
        </View>
      </View>
    </Pressable>
  );
}
