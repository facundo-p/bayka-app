import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, hitSlops, iconSizes } from '../theme';
import { dateAIso, isoADate, isoAFecha } from '../utils/fechaDeCalendario';
import { formFieldStyles } from './FormField.styles';
import { campoFechaStyles as styles } from './CampoFecha.styles';

type Props = {
  label: string;
  /** YYYY-MM-DD, o '' sin fecha. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
};

/** Campo de fecha opcional: tocarlo abre el calendario del sistema y la ✕ lo vacía. */
export default function CampoFecha({ label, value, onChange, placeholder, editable = true, testID }: Props) {
  function abrirCalendario() {
    DateTimePickerAndroid.open({
      value: isoADate(value) ?? new Date(),
      mode: 'date',
      onChange: (evento: DateTimePickerEvent, fecha?: Date) => {
        if (evento.type === 'set' && fecha) onChange(dateAIso(fecha));
      },
    });
  }

  const texto = isoAFecha(value);
  return (
    <View style={formFieldStyles.field}>
      <Text style={formFieldStyles.label}>{label}</Text>
      <Pressable
        testID={testID}
        style={[formFieldStyles.input, styles.caja]}
        onPress={abrirCalendario}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={texto ? `${label}: ${texto}` : label}
      >
        <Text style={[styles.valor, !texto && styles.placeholder]} numberOfLines={1}>
          {texto || placeholder}
        </Text>
        {texto ? (
          <Pressable
            onPress={() => onChange('')}
            disabled={!editable}
            hitSlop={hitSlops.chip}
            accessibilityRole="button"
            accessibilityLabel="Borrar fecha"
          >
            <Ionicons name="close-circle" size={iconSizes.action} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={iconSizes.action} color={colors.textMuted} />
        )}
      </Pressable>
    </View>
  );
}
