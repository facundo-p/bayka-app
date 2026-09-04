import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { colors } from '../theme';
import { formFieldStyles as styles } from './FormField.styles';

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
  keyboardType?: 'default' | 'numeric';
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
  keyboardType,
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
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}
