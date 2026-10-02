/**
 * Guardar y compartir la foto del visor: solo íconos, arriba a la derecha, a la izquierda de la ✕.
 */
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '../theme';
import { useAccionesDeFoto } from '../hooks/useAccionesDeFoto';
import { photoViewerAccionesStyles as styles } from './PhotoViewerAcciones.styles';

interface Props {
  uri: string | null;
  treeId?: string;
  onDescargada: (uriLocal: string) => void;
}

export default function PhotoViewerAcciones({ uri, treeId, onDescargada }: Props) {
  const insets = useSafeAreaInsets();
  const { ocupado, guardar, compartir } = useAccionesDeFoto(uri, treeId, onDescargada);

  return (
    <View style={[styles.barra, { top: insets.top + spacing.md }]}>
      {ocupado ? (
        <View style={styles.boton}>
          <ActivityIndicator size="small" color={colors.white} />
        </View>
      ) : (
        <>
          <Pressable style={styles.boton} onPress={guardar} accessibilityRole="button" accessibilityLabel="Guardar">
            <Ionicons name="download-outline" size={24} color={colors.white} />
          </Pressable>
          <Pressable style={styles.boton} onPress={compartir} accessibilityRole="button" accessibilityLabel="Compartir">
            <Ionicons name="share-social-outline" size={24} color={colors.white} />
          </Pressable>
        </>
      )}
    </View>
  );
}
