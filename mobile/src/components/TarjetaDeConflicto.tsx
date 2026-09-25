import { View, Text, Pressable } from 'react-native';
import { ELECCION, type ConflictoDeCampo, type Eleccion } from '../utils/conflictosDeEdicion';
import {
  ETIQUETA_DE_CAMPO,
  origenDeMiCambio,
  origenDelCambioWeb,
  textoAnterior,
  textoDeValor,
} from '../utils/textoDeConflicto';
import { tarjetaDeConflictoStyles as styles } from './TarjetaDeConflicto.styles';

type OpcionProps = { origen: string; valor: string; elegida: boolean; onPress: () => void };

function Opcion({ origen, valor, elegida, onPress }: OpcionProps) {
  return (
    <Pressable
      style={[styles.opcion, elegida && styles.opcionElegida]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida }}
      accessibilityLabel={`${origen}: ${valor}`}
    >
      <View style={[styles.radio, elegida && styles.radioElegido]}>
        {elegida && <View style={styles.radioPunto} />}
      </View>
      <View style={styles.opcionTexto}>
        <Text style={styles.origen}>{origen}</Text>
        <Text style={styles.valor}>{valor}</Text>
      </View>
    </Pressable>
  );
}

type Props = { conflicto: ConflictoDeCampo; eleccion: Eleccion; onElegir: (eleccion: Eleccion) => void };

/** Un campo que cambió en el teléfono y en la web: el usuario elige cuál queda (#634). */
export default function TarjetaDeConflicto({ conflicto, eleccion, onElegir }: Props) {
  const { campo } = conflicto;
  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>{ETIQUETA_DE_CAMPO[campo]}</Text>
      <Opcion
        origen={origenDeMiCambio(conflicto)}
        valor={textoDeValor(campo, conflicto.mio)}
        elegida={eleccion === ELECCION.mio}
        onPress={() => onElegir(ELECCION.mio)}
      />
      <Opcion
        origen={origenDelCambioWeb(conflicto)}
        valor={textoDeValor(campo, conflicto.web)}
        elegida={eleccion === ELECCION.web}
        onPress={() => onElegir(ELECCION.web)}
      />
      <Text style={styles.anterior}>{textoAnterior(conflicto)}</Text>
    </View>
  );
}
