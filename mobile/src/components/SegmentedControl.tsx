import { View, Text, Pressable } from 'react-native';
import { segmentedControlStyles as styles } from './SegmentedControl.styles';

export interface OpcionSegmentada<T extends string> {
  valor: T;
  etiqueta: string;
}

interface Props<T extends string> {
  opciones: readonly OpcionSegmentada<T>[];
  valor: T;
  onChange: (valor: T) => void;
}

/** Elegir una opción entre pocas, todas a la vista. */
export default function SegmentedControl<T extends string>({ opciones, valor, onChange }: Props<T>) {
  return (
    <View style={styles.segmentedControl}>
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable
            key={opcion.valor}
            style={[styles.segmentButton, activa && styles.segmentButtonActive]}
            onPress={() => onChange(opcion.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
          >
            <Text style={[styles.segmentLabel, activa && styles.segmentLabelActive]}>{opcion.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
