import { Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { viewAllTreesRowStyles as styles } from './ViewAllTreesRow.styles';

interface Props {
  totalCount: number;
  onPress: () => void;
}

/** Acceso a la lista de árboles del grupo; sin árboles queda deshabilitado. */
export default function ViewAllTreesRow({ totalCount, onPress }: Props) {
  const hayArboles = totalCount > 0;
  return (
    <Pressable
      style={({ pressed }) => [styles.viewAllRow, pressed && hayArboles && styles.viewAllRowPressed]}
      onPress={() => hayArboles && onPress()}
      disabled={!hayArboles}
    >
      <Ionicons name="list-outline" size={16} color={hayArboles ? colors.plantation : colors.textLight} />
      <Text style={[styles.viewAllText, !hayArboles && styles.viewAllTextDisabled]}>
        {hayArboles ? 'Ver todos los árboles' : 'Sin árboles cargados'}
      </Text>
      {hayArboles && <Ionicons name="chevron-forward" size={14} color={colors.plantation} />}
    </Pressable>
  );
}
