import React from 'react';
import { Pressable, View, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';
import { checkboxRowStyles as styles } from './CheckboxRow.styles';

interface Props {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function CheckboxRow({ label, checked, onToggle, disabled }: Props) {
  return (
    <Pressable
      style={styles.row}
      onPress={onToggle}
      disabled={disabled}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked, disabled && styles.checkboxDisabled]}>
        {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
    </Pressable>
  );
}
