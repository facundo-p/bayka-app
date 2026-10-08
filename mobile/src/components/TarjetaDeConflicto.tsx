import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, iconSizes } from '../theme';
import { ELECCION, type Eleccion } from '../utils/conflictosDeEdicion';
import type { OpcionDeConflicto, VistaDeConflicto } from '../utils/vistaDeConflicto';
import FotoDeConflicto from './FotoDeConflicto';
import { tarjetaDeConflictoStyles as styles } from './TarjetaDeConflicto.styles';

type OpcionProps = {
  opcion: OpcionDeConflicto;
  elegida: boolean;
  /** Por qué no se puede elegir: la opción queda deshabilitada. */
  motivo?: string | null;
  onPress: () => void;
};

function Radio({ elegida }: { elegida: boolean }) {
  return (
    <View testID="radio" style={[styles.radio, elegida && styles.radioElegido]}>
      {elegida && <View style={styles.radioPunto} />}
    </View>
  );
}

function ContenidoDeOpcion({ opcion, deshabilitada }: Pick<OpcionProps, 'opcion'> & { deshabilitada: boolean }) {
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

function etiquetaDe({ opcion, motivo }: Pick<OpcionProps, 'opcion' | 'motivo'>): string {
  const etiqueta = opcion.valor !== '' ? `${opcion.origen}: ${opcion.valor}` : opcion.origen;
  return motivo ? `${etiqueta}. ${motivo}` : etiqueta;
}

/** Deshabilitada: lo propio no se puede conservar, se ve tachado y sin radio. */
function Opcion({ opcion, elegida, motivo, onPress }: OpcionProps) {
  const deshabilitada = Boolean(motivo);
  return (
    <Pressable
      style={[styles.opcion, elegida && styles.opcionElegida, deshabilitada && styles.opcionDeshabilitada]}
      onPress={onPress}
      disabled={deshabilitada}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida, disabled: deshabilitada }}
      accessibilityLabel={etiquetaDe({ opcion, motivo })}
    >
      {!deshabilitada && <Radio elegida={elegida} />}
      <ContenidoDeOpcion opcion={opcion} deshabilitada={deshabilitada} />
    </Pressable>
  );
}

/** Lo que se pierde al guardar (una foto propia): con ícono, como aviso. */
function Advertencia({ texto }: { texto: string }) {
  return (
    <View style={styles.advertencia} testID="advertencia-de-conflicto">
      <Ionicons name="warning-outline" size={iconSizes.action} color={colors.conflictoText} />
      <Text style={styles.advertenciaTexto}>{texto}</Text>
    </View>
  );
}

function Notas({ vista }: { vista: VistaDeConflicto }) {
  return (
    <>
      {vista.nota ? <Text style={styles.nota}>{vista.nota}</Text> : null}
      {vista.advertencia ? <Advertencia texto={vista.advertencia} /> : null}
      {vista.motivo ? <Text style={styles.motivo}>{vista.motivo}</Text> : null}
      {vista.aviso ? <Text style={styles.motivo}>{vista.aviso}</Text> : null}
    </>
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
        motivo={vista.motivo}
        onPress={() => onElegir(ELECCION.mio)}
      />
      <Opcion
        opcion={vista.otro}
        elegida={sinLoMio || eleccion === ELECCION.web}
        onPress={() => onElegir(ELECCION.web)}
      />
      <Notas vista={vista} />
    </View>
  );
}
