import { Pressable, Text, Vibration } from 'react-native';
import { useState } from 'react';
import type { EstiloBotonera } from '../constants/estiloBotonera';
import { textosDelBoton } from '../utils/estiloBotonera';
import { NN_SPECIES_LABEL } from '../constants/especies';
import { speciesButtonStyles as styles } from './SpeciesButton.styles';

/** El botón para cargar un árbol sin especie identificada. */
export const BOTON_NN = { codigo: NN_SPECIES_LABEL, nombre: 'No identificado' } as const;

interface Props {
  codigo: string;
  nombre: string;
  estilo: EstiloBotonera;
  onPress: () => void;
  isNN?: boolean;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}

export default function SpeciesButton({ codigo, nombre, estilo, onPress, isNN = false, selected = false, disabled = false, testID }: Props) {
  const [pressed, setPressed] = useState(false);
  const [arriba, abajo] = textosDelBoton(estilo, codigo, nombre);
  const color = [isNN && styles.textoNN, selected && styles.textoSelected];

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        Vibration.vibrate(50);
        onPress();
      }}
      disabled={disabled}
      testID={testID}
      style={[
        styles.button,
        isNN && styles.buttonNN,
        selected && styles.buttonSelected,
        pressed && !selected && (isNN ? styles.buttonNNPressed : styles.buttonPressed),
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.textoArriba, ...color, { fontSize: arriba.tamano }]}>{arriba.texto}</Text>
      <Text style={[styles.textoAbajo, ...color, { fontSize: abajo.tamano }]}>{abajo.texto}</Text>
    </Pressable>
  );
}
