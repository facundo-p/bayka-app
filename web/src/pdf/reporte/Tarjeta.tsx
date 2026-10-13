import { View } from '@react-pdf/renderer';
import { Dato, DatosDeUbicacion, Foto, Gps, RenglonEspecie } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { Renglones } from '../plantilla/Renglones';
import { MEDIDA_REPORTE } from '../plantilla/tokens';
import { enTramos } from '../plantilla/tramos';
import type { TarjetaEnRenglones } from './renglonesReporte';
import { tarjetaStyles as styles } from './Reporte.styles';

function Datos({ tarjeta }: { tarjeta: TarjetaEnRenglones }) {
  return (
    <View style={styles.datos}>
      <Renglones renglones={tarjeta.idArbol} style={styles.idArbol} />
      <RenglonEspecie especie={tarjeta.especie} styles={styles} />
      <DatosDeUbicacion modelo={tarjeta} styles={styles} />
      <Dato rotulo={TEXTO_ARBOL.registrado} styles={styles}>
        {tarjeta.registrado}
      </Dato>
      <Dato rotulo={TEXTO_ARBOL.gps} styles={styles}>
        <Gps gps={tarjeta.gps} styles={styles} />
      </Dato>
    </View>
  );
}

/**
 * Mide lo que sus datos, con el alto de la foto de piso. No se parte entre
 * hojas: el plan ya sabe cuánto mide.
 */
export function Tarjeta({ tarjeta }: { tarjeta: TarjetaEnRenglones }) {
  return (
    <View style={styles.tarjeta} wrap={false}>
      <Foto foto={tarjeta.foto} styles={styles} />
      <Datos tarjeta={tarjeta} />
    </View>
  );
}

/** Las tarjetas de una hoja, en filas de a dos: cada fila mide lo que la más alta. */
export function GrillaTarjetas({ tarjetas }: { tarjetas: readonly TarjetaEnRenglones[] }) {
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
