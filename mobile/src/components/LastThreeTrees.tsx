import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { getSpeciesCode } from '../utils/speciesHelpers';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHIP_GAP = 6;
const CHIP_PADDING = 8;
const CHIP_WIDTH = (SCREEN_WIDTH - CHIP_PADDING * 2 - CHIP_GAP * 2) / 3;

export interface TreeChipItem {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  createdAt: string;
  subgrupoId: string;
  usuarioRegistro: string;
}

interface Props {
  trees: TreeChipItem[];
  onUndo: () => void;
}

export default function LastThreeTrees({ trees, onUndo }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
      <Text style={styles.label}>Últimos ingresados</Text>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.recentBg,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.recentBorder,
    gap: spacing.sm,
    width: CHIP_WIDTH,
  },
  chipEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  chipLast: {
    backgroundColor: colors.recentBgActive,
    borderColor: colors.recentText,
    borderWidth: 2,
  },
  chipText: {
    fontSize: fontSize.lg,
    fontFamily: fonts.semiBold,
    color: colors.recentText,
  },
  chipTextLast: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
  },
  undoButton: {
    padding: spacing.xs,
  },
});
