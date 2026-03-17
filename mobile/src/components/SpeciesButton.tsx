import { Pressable, Text, StyleSheet } from 'react-native';
import { useState } from 'react';

interface Props {
  codigo: string;
  nombre: string;
  onPress: () => void;
  isNN?: boolean;
  disabled?: boolean;
}

export default function SpeciesButton({ codigo, nombre, onPress, isNN = false, disabled = false }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        isNN && styles.buttonNN,
        pressed && (isNN ? styles.buttonNNPressed : styles.buttonPressed),
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.code, isNN && styles.codeNN]}>{codigo}</Text>
      <Text style={[styles.name, isNN && styles.nameNN]}>{nombre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 60,
    flex: 1,
    backgroundColor: '#f0f7f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  buttonPressed: {
    backgroundColor: '#a5d6a7',
    borderColor: '#66bb6a',
  },
  buttonNN: {
    backgroundColor: '#fff8e1',
    borderColor: '#ffca28',
  },
  buttonNNPressed: {
    backgroundColor: '#ffe082',
    borderColor: '#ffb300',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  code: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  codeNN: {
    color: '#e65100',
  },
  name: {
    fontSize: 11,
    color: '#388e3c',
    textAlign: 'center',
    marginTop: 2,
  },
  nameNN: {
    color: '#e65100',
  },
});
