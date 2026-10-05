import type { ComponentProps } from 'react';
import { View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { treeConfigModalStyles as styles, TAMANO_ICONO_OPCION } from './TreeConfigModal.styles';

export interface CabeceraDeOpcionProps {
  icono: ComponentProps<typeof Ionicons>['name'];
  color: string;
  titulo: string;
  descripcion: string;
}

/** Ícono, título y descripción de una fila de Opciones; la fila pone el contenedor. */
export default function CabeceraDeOpcion({ icono, color, titulo, descripcion }: CabeceraDeOpcionProps) {
  return (
    <>
      <Ionicons name={icono} size={TAMANO_ICONO_OPCION} color={color} />
      <View style={styles.optionInfo}>
        <Text style={styles.optionLabel}>{titulo}</Text>
        <Text style={styles.optionDesc}>{descripcion}</Text>
      </View>
    </>
  );
}
