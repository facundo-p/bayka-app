import { Text, View } from '@react-pdf/renderer';
import { ConCodigo, Dato, Foto, Gps, RenglonEspecie } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { MEDIDA_REPORTE } from '../plantilla/tokens';
import type { ModeloTarjeta } from './datosReporte';
import { enTramos } from './planReporte';
import { tarjetaStyles as styles } from './Reporte.styles';

/** Un renglón por dato, debajo de la especie. */
function Renglones({ tarjeta }: { tarjeta: ModeloTarjeta }) {
  const t = TEXTO_ARBOL;
  return (
    <>
      <Dato rotulo={t.parcela} styles={styles}>
        <ConCodigo entidad={tarjeta.parcela} styles={styles} />
      </Dato>
      <Dato rotulo={t.grupo} styles={styles}>
        <ConCodigo entidad={tarjeta.grupo} styles={styles} />
      </Dato>
      <Dato rotulo={t.posicion} styles={styles}>
        {tarjeta.posicion}
      </Dato>
      <Dato rotulo={t.registrado} styles={styles}>
        {tarjeta.registrado}
      </Dato>
      <Dato rotulo={t.gps} styles={styles}>
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
      <Renglones tarjeta={tarjeta} />
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
