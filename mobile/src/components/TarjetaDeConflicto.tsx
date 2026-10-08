import { View, Text, Pressable } from 'react-native';
import { ELECCION, type Eleccion } from '../utils/conflictosDeEdicion';
import type { OpcionDeConflicto, VistaDeConflicto } from '../utils/vistaDeConflicto';
import FotoDeConflicto from './FotoDeConflicto';
import { tarjetaDeConflictoStyles as styles } from './TarjetaDeConflicto.styles';

type OpcionProps = { opcion: OpcionDeConflicto; elegida: boolean; deshabilitada?: boolean; onPress: () => void };

function Radio({ elegida }: { elegida: boolean }) {
  return (
    <View style={[styles.radio, elegida && styles.radioElegido]}>
      {elegida && <View style={styles.radioPunto} />}
    </View>
  );
}

function ContenidoDeOpcion({ opcion, deshabilitada }: Pick<OpcionProps, 'opcion' | 'deshabilitada'>) {
  return (
    <View style={styles.opcionTexto}>
      <Text style={[styles.origen, deshabilitada && styles.textoDeshabilitado]}>{opcion.origen}</Text>
      {opcion.foto && <FotoDeConflicto {...opcion.foto} />}
      {opcion.valor !== '' && (
        <Text style={[styles.valor, deshabilitada && styles.valorTachado]}>{opcion.valor}</Text>
      )}
      {opcion.detalle ? <Text style={styles.detalle}>{opcion.detalle}</Text> : null}
    </View>
  );
}

/** Deshabilitada: lo propio no se puede conservar, se ve tachado y sin radio activo. */
function Opcion({ opcion, elegida, deshabilitada = false, onPress }: OpcionProps) {
  const etiqueta = opcion.valor !== '' ? `${opcion.origen}: ${opcion.valor}` : opcion.origen;
  return (
    <Pressable
      style={[styles.opcion, elegida && styles.opcionElegida, deshabilitada && styles.opcionDeshabilitada]}
      onPress={onPress}
      disabled={deshabilitada}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida, disabled: deshabilitada }}
      accessibilityLabel={etiqueta}
    >
      <Radio elegida={elegida} />
      <ContenidoDeOpcion opcion={opcion} deshabilitada={deshabilitada} />
    </Pressable>
  );
}

type Props = { vista: VistaDeConflicto; eleccion: Eleccion; onElegir: (eleccion: Eleccion) => void };

/** Un dato que cambió en el teléfono y en otro lado: el usuario elige cuál queda (#634, #804). */
export default function TarjetaDeConflicto({ vista, eleccion, onElegir }: Props) {
  const sinLoMio = Boolean(vista.motivo);
  return (
    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>{vista.titulo}</Text>
      <Opcion
        opcion={vista.mio}
        elegida={!sinLoMio && eleccion === ELECCION.mio}
        deshabilitada={sinLoMio}
        onPress={() => onElegir(ELECCION.mio)}
      />
      <Opcion
        opcion={vista.otro}
        elegida={sinLoMio || eleccion === ELECCION.web}
        onPress={() => onElegir(ELECCION.web)}
      />
      {vista.nota ? <Text style={styles.nota}>{vista.nota}</Text> : null}
      {vista.motivo ? <Text style={styles.motivo}>{vista.motivo}</Text> : null}
    </View>
  );
}
