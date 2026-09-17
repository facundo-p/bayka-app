import { View, Text, Pressable } from 'react-native';
import type { GroupTipo } from '../repositories/GroupRepository';
import { GROUP_TIPO, GROUP_TIPO_LABELS } from '../constants/groupTipo';
import { tipoSegmentedControlStyles as styles } from './TipoSegmentedControl.styles';

interface Props {
  value: GroupTipo;
  onChange: (tipo: GroupTipo) => void;
}

export default function TipoSegmentedControl({ value, onChange }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Tipo</Text>
      <View style={styles.segmentedControl}>
        {Object.values(GROUP_TIPO).map((tipo) => (
          <Pressable
            key={tipo}
            style={[styles.segmentButton, value === tipo && styles.segmentButtonActive]}
            onPress={() => onChange(tipo)}
          >
            <Text style={[styles.segmentLabel, value === tipo && styles.segmentLabelActive]}>
              {GROUP_TIPO_LABELS[tipo]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
