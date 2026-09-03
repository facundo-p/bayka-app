import { Pressable, Text, Vibration } from 'react-native';
import { useState } from 'react';
import { speciesButtonStyles as styles } from './SpeciesButton.styles';

interface Props {
  codigo: string;
  nombre: string;
  onPress: () => void;
  isNN?: boolean;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}

export default function SpeciesButton({ codigo, nombre, onPress, isNN = false, selected = false, disabled = false, testID }: Props) {
  const [pressed, setPressed] = useState(false);

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
      <Text style={[styles.code, isNN && styles.codeNN, selected && styles.codeSelected]}>{codigo}</Text>
      <Text style={[styles.name, isNN && styles.nameNN, selected && styles.nameSelected]}>{nombre}</Text>
    </Pressable>
  );
}
