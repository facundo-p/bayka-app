import { Pressable, Text, StyleSheet, Vibration } from 'react-native';
import { useState } from 'react';
import { colors, fontSize, spacing, borderRadius } from '../theme';

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
      onPress={() => {
        Vibration.vibrate(50);
        onPress();
      }}
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
    backgroundColor: colors.primaryBgLight,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  buttonPressed: {
    backgroundColor: colors.primaryBgMuted,
    borderColor: colors.primaryAccent,
  },
  buttonNN: {
    backgroundColor: colors.secondaryYellowLight,
    borderColor: colors.secondaryYellow,
  },
  buttonNNPressed: {
    backgroundColor: colors.secondaryYellowMedium,
    borderColor: colors.secondaryYellowDark,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  code: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.primaryDark,
  },
  codeNN: {
    color: colors.secondary,
  },
  name: {
    fontSize: fontSize.xs,
    color: colors.primaryMedium,
    textAlign: 'center',
    marginTop: 2,
  },
  nameNN: {
    color: colors.secondary,
  },
});
