/**
 * Plantaciones cuya edición chocó con un cambio de la web en este sync (#634). Lo demás
 * subió; esos campos quedan con el valor de la web hasta que el usuario elija.
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import type { SyncPlantationResult } from '../services/SyncService';
import { cambiosPorResolverDe } from '../utils/conflictosDeEdicion';
import { cambiosPorResolverAvisoStyles as styles } from './CambiosPorResolverAviso.styles';

type Props = { resultados: SyncPlantationResult[]; onResolver?: (plantacionId: string) => void };

function detalle(cantidad: number): string {
  return cantidad > 1
    ? `${cantidad} datos cambiaron también en la web. Elegí cuáles quedan.`
    : 'Un dato cambió también en la web. Elegí cuál queda.';
}

export default function CambiosPorResolverAviso({ resultados, onResolver }: Props) {
  const plantaciones = cambiosPorResolverDe(resultados);
  if (plantaciones.length === 0) return null;
  return (
    <View style={styles.aviso}>
      {plantaciones.map(({ plantacionId, nombre, cantidad }) => (
        <View key={plantacionId} style={styles.fila}>
          <Ionicons name="warning-outline" size={iconSizes.action} color={colors.conflictoText} />
          <View style={styles.texto}>
            <Text style={styles.nombre}>{nombre}</Text>
            <Text style={styles.detalle}>{detalle(cantidad)}</Text>
          </View>
          {onResolver && (
            <Pressable style={styles.boton} onPress={() => onResolver(plantacionId)} accessibilityRole="button">
              <Text style={styles.botonTexto}>Resolver</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
