import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import { conflictosDelGrupoAvisoStyles as styles } from './ConflictosDelGrupoAviso.styles';

type Props = { texto: string; onResolver: () => void };

/** Arriba del grupo: qué tiene cambios por resolver y el acceso a elegir (#804). */
export default function ConflictosDelGrupoAviso({ texto, onResolver }: Props) {
  return (
    <View style={styles.aviso}>
      <Ionicons name="warning-outline" size={iconSizes.action} color={colors.conflictoText} />
      <Text style={styles.texto}>{texto}</Text>
      <Pressable style={styles.boton} onPress={onResolver} accessibilityRole="button">
        <Text style={styles.botonTexto}>Resolver</Text>
      </Pressable>
    </View>
  );
}
