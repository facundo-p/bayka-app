import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface Props {
  posicion: number;
  especieCodigo: string | null;
  subId: string;
  fotoUrl?: string | null;
  isLast: boolean;
  onDelete?: () => void;
  onAttachPhoto?: () => void;
}

export default function TreeRow({ posicion, especieCodigo, subId, fotoUrl, isLast, onDelete, onAttachPhoto }: Props) {
  const displayCode = especieCodigo ?? 'N/N';

  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.position}>{posicion}</Text>
      <Text style={styles.code}>{displayCode}</Text>
      <Text style={styles.subId} numberOfLines={1}>{subId}</Text>
      {onAttachPhoto && (
        <Pressable onPress={onAttachPhoto} style={styles.photoButton} hitSlop={12}>
          <Text style={styles.photoIcon}>{fotoUrl ? '🖼' : '📷'}</Text>
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
  position: { fontSize: fontSize.xl, fontWeight: 'bold', color: colors.textMedium, minWidth: 28 },
  code: { fontSize: fontSize.xl, fontWeight: '600', color: colors.primary, minWidth: 48 },
  subId: { fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  photoButton: { padding: spacing.xs },
  photoIcon: { fontSize: fontSize.xl },
  undoButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.dangerBg, borderRadius: borderRadius.sm },
  undoText: { fontSize: fontSize.sm, color: colors.danger, fontWeight: '600' },
});
