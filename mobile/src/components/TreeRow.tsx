import { Pressable, Text, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  posicion: number;
  especieCodigo: string | null;
  subId: string;
  fotoUrl?: string | null;
  fotoSynced?: boolean;
  isLast: boolean;
  onDelete?: () => void;
  onAttachPhoto?: () => void;
}

export default function TreeRow({ posicion, especieCodigo, subId, fotoUrl, fotoSynced, isLast, onDelete, onAttachPhoto }: Props) {
  const displayCode = especieCodigo ?? 'N/N';

  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.position}>{posicion}</Text>
      <Text style={styles.code}>{displayCode}</Text>
      <Text style={styles.subId} numberOfLines={1}>{subId}</Text>
      {onAttachPhoto && (
        <Pressable
          onPress={onAttachPhoto}
          style={styles.photoButton}
          hitSlop={12}
          accessibilityLabel={
            !fotoUrl ? 'Sin foto' :
            fotoSynced ? 'Foto sincronizada' :
            'Foto pendiente de subida'
          }
        >
          <View>
            <Ionicons
              name={fotoUrl ? 'image' : 'image-outline'}
              size={18}
              color={colors.primaryAccent}
            />
            {fotoUrl && !fotoSynced && (
              <View style={[styles.syncDot, { backgroundColor: colors.stateFinalizada }]} />
            )}
            {fotoUrl && fotoSynced && (
              <View style={[styles.syncDot, { backgroundColor: colors.statSynced }]} />
            )}
          </View>
        </Pressable>
      )}
      {isLast && onDelete && (
        <Pressable onPress={onDelete} style={styles.undoButton} hitSlop={12}>
          <Text style={styles.undoText}>Deshacer</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  rowLast: {
    backgroundColor: colors.primaryBgLight,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  position: { fontSize: fontSize.xl, fontFamily: fonts.bold, color: colors.textMedium, minWidth: 28 },
  code: { fontSize: fontSize.xl, fontFamily: fonts.semiBold, color: colors.primary, minWidth: 48 },
  subId: { fontSize: fontSize.sm, fontFamily: fonts.regular, color: colors.textMuted, flex: 1 },
  photoButton: { padding: spacing.xs },
  syncDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  undoButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.dangerBg, borderRadius: borderRadius.sm },
  undoText: { fontSize: fontSize.sm, color: colors.danger, fontFamily: fonts.semiBold },
});
