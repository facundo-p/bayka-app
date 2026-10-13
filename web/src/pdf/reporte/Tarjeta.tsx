import { Text, View } from '@react-pdf/renderer';
import { ConCodigo, Dato, Foto, Gps, RenglonEspecie } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { MEDIDA_REPORTE } from '../plantilla/tokens';
import type { ModeloTarjeta } from './datosReporte';
import { enTramos } from './planReporte';
import { tarjetaStyles as styles } from './Reporte.styles';

function Ubicacion({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <>
      <Dato rotulo={TEXTO_ARBOL.parcela} styles={styles}>
        <ConCodigo entidad={tarjeta.parcela} styles={styles} />
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.grupo} styles={styles}>
        <ConCodigo entidad={tarjeta.grupo} styles={styles} />
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.posicion} styles={styles}>
        {tarjeta.posicion}
      </Dato>
    </>
  );
}

/** El GPS va con la fecha: los dos los toma el registro. */
function Registro({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <>
      <Dato rotulo={TEXTO_ARBOL.registrado} styles={styles}>
        {tarjeta.registrado}
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.gps} styles={styles}>
        <Gps gps={tarjeta.gps} styles={styles} />
      </Dato>
    </>
  );
}

function Datos({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <View style={styles.datos}>
      <Text style={styles.idArbol}>{tarjeta.idArbol}</Text>
      <RenglonEspecie especie={tarjeta.especie} styles={styles} />
      <Ubicacion tarjeta={tarjeta} />
      <Registro tarjeta={tarjeta} />
    </View>
  );
}

/** Alto fijo y texto de un renglón: nunca se parte ni empuja a la siguiente. */
export function Tarjeta({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  return (
    <View style={styles.tarjeta} wrap={false}>
      <Foto foto={tarjeta.foto} styles={styles} />
      <Datos tarjeta={tarjeta} />
    </View>
  );
}

/** Las tarjetas de una hoja, en filas de a dos. */
export function GrillaTarjetas({ tarjetas }: { tarjetas: readonly ModeloTarjeta[] }) {
  return (
    <View style={styles.grilla}>
      {enTramos(tarjetas, MEDIDA_REPORTE.columnasTarjetas).map((fila, indiceFila) => (
        <View key={indiceFila} style={styles.fila}>
          {fila.map((tarjeta, indice) => (
            <Tarjeta key={indice} tarjeta={tarjeta} />
          ))}
        </View>
      ))}
    </View>
  );
}
