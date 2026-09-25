import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, iconSizes } from '../theme';
import { dateAIso, isoADate, isoAFecha } from '../utils/fechaDeCalendario';
import { formFieldStyles } from './FormField.styles';
import { campoFechaStyles as styles } from './CampoFecha.styles';

/** Postgres rechaza el año 0 y Date lleva los años 0–99 a 1900+. */
const FECHA_MINIMA = new Date(1900, 0, 1);

type Props = {
  label: string;
  /** YYYY-MM-DD, o '' sin fecha. */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
};

function abrirCalendario(value: string, onChange: (iso: string) => void) {
  DateTimePickerAndroid.open({
    value: isoADate(value) ?? new Date(),
    mode: 'date',
    minimumDate: FECHA_MINIMA,
    onChange: (evento: DateTimePickerEvent, fecha?: Date) => {
      if (evento.type === 'set' && fecha) onChange(dateAIso(fecha));
    },
  });
}

/**
 * Campo de fecha opcional: tocarlo abre el diálogo de calendario de Android
 * (en iOS no abre nada) y la ✕ lo vacía.
 */
export default function CampoFecha({ label, value, onChange, placeholder, editable = true, testID }: Props) {
  const texto = isoAFecha(value);
  return (
    <View style={formFieldStyles.field}>
      <Text style={formFieldStyles.label}>{label}</Text>
      <View style={[formFieldStyles.input, styles.caja]}>
        <Pressable
          testID={testID}
          style={[styles.valor, texto ? null : styles.valorSinBorrar]}
          onPress={() => abrirCalendario(value, onChange)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={texto ? `${label}: ${texto}` : label}
        >
          <Text style={[styles.texto, !texto && styles.placeholder]} numberOfLines={1}>
            {texto || placeholder}
          </Text>
          {texto ? null : <Ionicons name="calendar-outline" size={iconSizes.action} color={colors.textMuted} />}
        </Pressable>
        {texto ? (
          <Pressable
            testID={testID ? `${testID}-borrar` : undefined}
            style={styles.borrar}
            onPress={() => onChange('')}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityLabel="Borrar fecha"
          >
            <Ionicons name="close-circle" size={iconSizes.action} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
