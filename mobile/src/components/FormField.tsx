import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fonts } from '../theme';

interface Props {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  autoCapitalize?: 'none' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  helperText?: string | null;
}

export default function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize,
  autoCorrect,
  editable,
  helperText,
}: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.xxxl,
  },
  label: {
    fontSize: fontSize.base,
    fontFamily: fonts.semiBold,
    color: colors.textMedium,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.button,
    paddingVertical: spacing.xl,
    fontSize: fontSize.xl,
    fontFamily: fonts.regular,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.dangerLight,
  },
  errorText: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.dangerLight,
    marginTop: spacing.sm,
  },
  helperText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
