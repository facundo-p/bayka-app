import { Text, View } from 'react-native';
import { avisoPlantacionDuplicadaStyles as styles } from './AvisoPlantacionDuplicada.styles';

type Props = { lugar: string; periodo: string; editando: boolean };

const SUGERENCIA_AL_CREAR = 'Si es la misma, cancelá y editá esa. Si no, podés crearla igual.';
const SUGERENCIA_AL_EDITAR = 'Revisá que no sea la misma. Podés guardar igual.';

/** Advertencia bajo lugar y periodo: no frena el guardado (#633). */
export default function AvisoPlantacionDuplicada({ lugar, periodo, editando }: Props) {
  return (
    <View style={styles.caja} accessibilityRole="alert">
      <Text style={styles.titulo}>{`Ya tenés una "${lugar} · ${periodo}"`}</Text>
      <Text style={styles.texto}>{editando ? SUGERENCIA_AL_EDITAR : SUGERENCIA_AL_CREAR}</Text>
    </View>
  );
}
