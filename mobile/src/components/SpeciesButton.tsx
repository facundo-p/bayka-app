import { Pressable, Text, StyleSheet, Vibration } from 'react-native';
import { useState } from 'react';
import { colors, fontSize, spacing, borderRadius } from '../theme';

interface Props {
  codigo: string;
  nombre: string;
  onPress: () => void;
  isNN?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

export default function SpeciesButton({ codigo, nombre, onPress, isNN = false, selected = false, disabled = false }: Props) {
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
  buttonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
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
  codeSelected: {
    color: colors.white,
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
  nameSelected: {
    color: colors.white,
  },
});
