import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { stepperNumericoStyles as styles, TAMANO_ICONO_STEPPER } from './StepperNumerico.styles';

interface Props {
  etiqueta: string;
  descripcion?: string;
  valor: number;
  min: number;
  max: number;
  onChange: (valor: number) => void;
  testID?: string;
}

/** Un número entero que se sube o baja de a uno, sin salir de [min, max]. */
export default function StepperNumerico({ etiqueta, descripcion, valor, min, max, onChange, testID }: Props) {
  const puedeBajar = valor > min;
  const puedeSubir = valor < max;
  return (
    <View style={styles.fila} testID={testID}>
      <View style={styles.textos}>
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}
      </View>
      <Pressable
        style={[styles.boton, !puedeBajar && styles.botonDeshabilitado]}
        onPress={() => onChange(valor - 1)}
        disabled={!puedeBajar}
        accessibilityRole="button"
        accessibilityLabel={`Bajar ${etiqueta.toLowerCase()}`}
        accessibilityState={{ disabled: !puedeBajar }}
        testID={testID && `${testID}-menos`}
      >
        <Ionicons name="remove" size={TAMANO_ICONO_STEPPER} color={colors.text} />
      </Pressable>
      <Text style={styles.valor} testID={testID && `${testID}-valor`}>{valor}</Text>
      <Pressable
        style={[styles.boton, !puedeSubir && styles.botonDeshabilitado]}
        onPress={() => onChange(valor + 1)}
        disabled={!puedeSubir}
        accessibilityRole="button"
        accessibilityLabel={`Subir ${etiqueta.toLowerCase()}`}
        accessibilityState={{ disabled: !puedeSubir }}
        testID={testID && `${testID}-mas`}
      >
        <Ionicons name="add" size={TAMANO_ICONO_STEPPER} color={colors.text} />
      </Pressable>
    </View>
  );
}
