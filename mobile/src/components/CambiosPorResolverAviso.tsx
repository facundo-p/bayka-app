/**
 * Plantaciones de este sync con datos que cambiaron también en otro lado: campos de la
 * edición que chocaron con la web (#634) y conflictos de sincronización de grupos y
 * árboles (#804). Lo demás subió; esos datos quedan con el valor del servidor hasta
 * que el usuario elija.
 */
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import type { SyncPlantationResult } from '../services/SyncService';
import { cambiosPorResolverDe, type PlantacionConCambios } from '../utils/conflictosDeEdicion';
import { cambiosPorResolverAvisoStyles as styles } from './CambiosPorResolverAviso.styles';

type Props = {
  resultados: SyncPlantationResult[];
  conflictosDeSync?: PlantacionConCambios[];
  onResolver?: (plantacionId: string) => void;
};

function detalle(cantidad: number): string {
  return cantidad > 1
    ? `${cantidad} datos cambiaron también en otro celular o en la web. Elegí cuáles quedan.`
    : 'Un dato cambió también en otro celular o en la web. Elegí cuál queda.';
}

export default function CambiosPorResolverAviso({ resultados, conflictosDeSync, onResolver }: Props) {
  const plantaciones = cambiosPorResolverDe(resultados, conflictosDeSync);
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
