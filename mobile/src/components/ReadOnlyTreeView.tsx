import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';

export interface ReadOnlyTreeItem {
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
  trees: ReadOnlyTreeItem[];
  canReactivate: boolean;
  onReactivate: () => void;
  onViewPhoto: (treeId: string, uri: string) => void;
}

export default function ReadOnlyTreeView({ trees, canReactivate, onReactivate, onViewPhoto }: Props) {
  return (
    <>
      {canReactivate && (
        <View style={styles.reactivateBar}>
          <Pressable style={styles.reactivateButton} onPress={onReactivate}>
            <Ionicons name="refresh-outline" size={18} color={colors.plantation} />
            <Text style={styles.reactivateText}>Editar</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={trees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.pos}>{item.posicion}</Text>
            <Text style={[styles.name, item.especieId === null && styles.nameNN]} numberOfLines={1}>
              {getSpeciesName(item)}
            </Text>
            <Text style={styles.code} numberOfLines={1}>{getSpeciesCode(item)}</Text>
            <View style={styles.actions}>
              {item.fotoUrl
                ? <Pressable onPress={() => onViewPhoto(item.id, item.fotoUrl!)} hitSlop={8} style={styles.btn}>
                    <Ionicons name="image" size={18} color={colors.plantation} />
                  </Pressable>
                : null}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay árboles</Text>}
      />
    </>
  );
}

const styles = StyleSheet.create({
  reactivateBar: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.plantationBg, alignItems: 'flex-start',
  },
  reactivateButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface,
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.plantation,
  },
  reactivateText: { color: colors.plantation, fontFamily: fonts.semiBold, fontSize: fontSize.base },
  listContent: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing['6xl'] },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  pos: { fontSize: fontSize.base, fontFamily: fonts.bold, color: colors.textMedium, width: 26, textAlign: 'center' },
  name: { fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.plantation, flex: 1 },
  nameNN: { color: colors.secondary },
  code: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: 'monospace', minWidth: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { padding: spacing.xs },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['6xl'], fontSize: fontSize.lg },
});
