import { Pressable, Text, View, StyleSheet } from 'react-native';

interface Props {
  posicion: number;
  especieCodigo: string | null;
  subId: string;
  isLast: boolean;
  onDelete?: () => void;
}

export default function TreeRow({ posicion, especieCodigo, subId, isLast, onDelete }: Props) {
  const displayCode = especieCodigo ?? 'N/N';

  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.position}>{posicion}</Text>
      <Text style={styles.code}>{displayCode}</Text>
      <Text style={styles.subId} numberOfLines={1}>{subId}</Text>
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    gap: 8,
  },
  rowLast: {
    backgroundColor: '#f0f7f0',
    borderLeftWidth: 3,
    borderLeftColor: '#4caf50',
  },
  position: { fontSize: 16, fontWeight: 'bold', color: '#333', minWidth: 28 },
  code: { fontSize: 16, fontWeight: '600', color: '#2d6a2d', minWidth: 48 },
  subId: { fontSize: 12, color: '#888', flex: 1 },
  undoButton: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#ffebee', borderRadius: 4 },
  undoText: { fontSize: 12, color: '#c62828', fontWeight: '600' },
});
