import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';
import { getSpeciesCode, getSpeciesName } from '../utils/speciesHelpers';

export interface TreeItemData {
  id: string;
  posicion: number;
  especieId: string | null;
  especieCodigo?: string | null;
  especieNombre?: string | null;
  subId: string;
  fotoUrl?: string | null;
  fotoSynced?: boolean;
  createdAt: string;
  subgrupoId: string;
  usuarioRegistro: string;
}

interface Props {
  item: TreeItemData;
  isReadOnly: boolean;
  isDeleting?: boolean;
  onViewPhoto: (treeId: string, uri: string) => void;
  onAttachPhoto?: (treeId: string) => void;
  onDeleteTree?: (treeId: string, posicion: number) => void;
}

export default function TreeRowItem({ item, isReadOnly, isDeleting, onViewPhoto, onAttachPhoto, onDeleteTree }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.pos}>{item.posicion}</Text>
      <Text style={[styles.name, item.especieId === null && styles.nameNN]} numberOfLines={1}>
        {getSpeciesName(item)}
      </Text>
      <Text style={styles.code} numberOfLines={1}>{getSpeciesCode(item)}</Text>
      <View style={styles.actions}>
        {item.fotoUrl
          ? <Pressable onPress={() => onViewPhoto(item.id, item.fotoUrl!)} hitSlop={8} style={styles.btn}>
              <View>
                <Ionicons name="image" size={18} color={colors.plantation} />
                {item.fotoUrl && !item.fotoSynced && (
                  <View style={styles.syncDot} />
                )}
              </View>
            </Pressable>
          : !isReadOnly && onAttachPhoto
            ? <Pressable onPress={() => onAttachPhoto(item.id)} hitSlop={8} style={styles.btn}>
                <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
              </Pressable>
            : null}
        {!isReadOnly && onDeleteTree && (
          <Pressable onPress={() => onDeleteTree(item.id, item.posicion)}
            hitSlop={8} style={styles.btn} disabled={isDeleting}>
            {isDeleting
              ? <ActivityIndicator size="small" color={colors.danger} />
              : <Ionicons name="trash-outline" size={18} color={colors.danger} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

export const treeRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.md,
  },
  pos: { fontSize: fontSize.base, fontFamily: fonts.bold, color: colors.textMedium, width: 26, textAlign: 'center' },
  name: { fontSize: fontSize.md, fontFamily: fonts.semiBold, color: colors.plantation, flex: 1 },
  nameNN: { color: colors.secondary },
  code: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: fonts.monospace, minWidth: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: { padding: spacing.xs },
  syncDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.photoUnsyncDot,
  },
});

const styles = treeRowStyles;
