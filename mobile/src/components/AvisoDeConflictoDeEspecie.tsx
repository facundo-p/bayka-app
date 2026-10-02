/**
 * La especie del árbol cambió acá y en el server (#679). Quien puede editarlo
 * elige cuál queda; el resto ve el aviso que explica la marca de la fila.
 */
import { View, Text, Pressable } from 'react-native';
import type { TreeDetail } from '../hooks/useTreeDetail';
import { ESPECIE_DESCONOCIDA } from '../services/sync/conflictosDeEspecie';
import { getSpeciesName } from '../utils/speciesHelpers';
import { avisoDeConflictoDeEspecieStyles as styles } from './AvisoDeConflictoDeEspecie.styles';

export const textoConflictoDeEspecie = (especieServidor: string) =>
  `La especie también cambió en otro lado: allá quedó ${especieServidor}. Elegí cuál queda.`;

export const textoConflictoSoloLectura = (especieServidor: string) =>
  `La especie también cambió en otro lado: allá quedó ${especieServidor}. ` +
  'Elige cuál queda quien registró el árbol, con la plantación activa.';

export const etiquetaEspecieDelServidor = (nombre: string) => `La del servidor: ${nombre}`;
export const etiquetaEspecieLocal = (nombre: string) => `La mía: ${nombre}`;

interface Props {
  tree: TreeDetail;
  /** Sin acciones, el aviso es de solo lectura. */
  acciones?: { usarDelServidor: () => void; mantenerLocal: () => void; ocupado: boolean };
}

function BotonDeConflicto({ texto, onPress, ocupado }: { texto: string; onPress: () => void; ocupado: boolean }) {
  return (
    <Pressable style={styles.conflictoBoton} onPress={onPress} disabled={ocupado} accessibilityRole="button">
      <Text style={styles.conflictoBotonTexto}>{texto}</Text>
    </Pressable>
  );
}

export default function AvisoDeConflictoDeEspecie({ tree, acciones }: Props) {
  const servidor = tree.conflictEspecieNombre ?? ESPECIE_DESCONOCIDA;
  if (!acciones) {
    return (
      <View style={styles.conflicto}>
        <Text style={styles.conflictoTexto}>{textoConflictoSoloLectura(servidor)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.conflicto}>
      <Text style={styles.conflictoTexto}>{textoConflictoDeEspecie(servidor)}</Text>
      <View style={styles.conflictoAcciones}>
        <BotonDeConflicto texto={etiquetaEspecieDelServidor(servidor)} onPress={acciones.usarDelServidor} ocupado={acciones.ocupado} />
        <BotonDeConflicto texto={etiquetaEspecieLocal(getSpeciesName(tree))} onPress={acciones.mantenerLocal} ocupado={acciones.ocupado} />
      </View>
    </View>
  );
}
