/**
 * ParcelaRow — presentational row for a parcela (D-17-05/-06/-22).
 *
 * Reusable in standalone list (ParcelasScreen) and inline (PlantationCard expansion, Plan 17-02).
 * Does NOT render `descripcion` (D-17-05).
 * Touch target ≥44×44 (D-17-22).
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import OrangeDot from './OrangeDot';
import { colors, iconSizes } from '../theme';
import { parcelaRowStyles as styles } from './ParcelaRow.styles';
import type { ParcelaWithStats } from '../queries/parcelaQueries';

export type ParcelaRowVariant = 'standalone' | 'inline';

interface Props {
  parcela: ParcelaWithStats;
  onPress: () => void;
  onLongPress: () => void;
  variant?: ParcelaRowVariant;
}

function ParcelaStats({ gruposCount, treesCount }: { gruposCount: number; treesCount: number }) {
  return (
    <View style={styles.statsLine}>
      <View style={styles.statItem}>
        <Ionicons name="leaf-outline" size={iconSizes.stat} color={colors.plantationDark} />
        <Text style={styles.statText}>{gruposCount}</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="git-branch-outline" size={iconSizes.stat} color={colors.textSecondary} />
        <Text style={styles.statText}>{treesCount}</Text>
      </View>
    </View>
  );
}

function ParcelaHeading({ nombre, codigo }: { nombre: string; codigo: string }) {
  return (
    <View style={styles.headingLine}>
      <Text style={styles.nombre} numberOfLines={1}>{nombre}</Text>
      <View style={styles.codigoChip}>
        <Text style={styles.codigoText}>{codigo}</Text>
      </View>
    </View>
  );
}

export default function ParcelaRow({ parcela, onPress, onLongPress, variant = 'standalone' }: Props) {
  const showDot = parcela.pendingSync || parcela.pendingSyncBelow;
  const baseStyle = variant === 'inline' ? styles.rowInline : styles.rowStandalone;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [baseStyle, pressed && styles.rowPressed]}
      accessibilityLabel={`Parcela ${parcela.nombre}`}
      accessibilityHint="Tocar para ver grupos. Mantener presionado para editar."
    >
      <View style={styles.leftContent}>
        <ParcelaHeading nombre={parcela.nombre} codigo={parcela.codigo} />
        <ParcelaStats gruposCount={parcela.gruposCount} treesCount={parcela.treesCount} />
      </View>
      <View style={styles.rightContent}>
        {showDot && <OrangeDot />}
        <Ionicons name="chevron-forward" size={iconSizes.action} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
