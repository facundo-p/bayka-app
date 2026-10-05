import { View, Text } from 'react-native';
import type { GroupTipo } from '../repositories/GroupRepository';
import { GROUP_TIPO, GROUP_TIPO_LABELS } from '../constants/groupTipo';
import SegmentedControl from './SegmentedControl';
import { tipoSegmentedControlStyles as styles } from './TipoSegmentedControl.styles';

const OPCIONES_DE_TIPO = Object.values(GROUP_TIPO).map((tipo) => ({ valor: tipo, etiqueta: GROUP_TIPO_LABELS[tipo] }));

interface Props {
  value: GroupTipo;
  onChange: (tipo: GroupTipo) => void;
}

export default function TipoSegmentedControl({ value, onChange }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Tipo</Text>
      <SegmentedControl opciones={OPCIONES_DE_TIPO} valor={value} onChange={onChange} />
    </View>
  );
}
