import { Switch, Text, View } from 'react-native';
import { colors } from '../theme';
import { switchRowStyles as styles } from './SwitchRow.styles';

type Props = {
  label: string;
  helperText?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  /** Color del riel encendido. */
  activeColor?: string;
};

/** Interruptor con título y ayuda, para las opciones de un formulario. */
export default function SwitchRow({
  label, helperText, value, onValueChange, disabled, testID, activeColor = colors.secondary,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Text style={styles.label}>{label}</Text>
        {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: activeColor }}
        accessibilityLabel={label}
      />
    </View>
  );
}
