/* Lo que la tarjeta y la fila del listado pintan igual. */
import { Text, View, type Styles } from '@react-pdf/renderer';
import { SIN_DATO } from '../../lib/formato';
import type { CodigoNombre } from '../../queries/fichasQueries';
import type { GpsFicha } from '../ficha/datosFicha';
import type { EspecieReporte } from './datosReporte';
import { reporteStyles as styles } from './Reporte.styles';

type Estilo = Styles[string];

type EspecieProps = { especie: EspecieReporte; style: Estilo; estiloTexto: Estilo };

/** El punto de color y el rótulo; N/N va en ámbar. */
export function Especie({ especie, style, estiloTexto }: EspecieProps) {
  return (
    <View style={style}>
      {/* El color sale del dato, no del tema: única propiedad de estilo en el componente. */}
      <View style={[styles.punto, { backgroundColor: especie.color }]} />
      <Text style={[estiloTexto, especie.sinIdentificar ? styles.sinIdentificar : {}]}>
        {especie.titulo}
      </Text>
    </View>
  );
}

/** Va dentro de un `Text`: el código en mono y el nombre a continuación. */
export function ConCodigo({ entidad }: { entidad: CodigoNombre | null }) {
  if (!entidad) return SIN_DATO;
  return (
    <>
      <Text style={styles.codigo}>{entidad.codigo}</Text> {entidad.nombre}
    </>
  );
}

/** Va dentro de un `Text`: coordenadas en mono y la precisión apagada. */
export function Gps({ gps }: { gps: GpsFicha | null }) {
  if (!gps) return SIN_DATO;
  return (
    <>
      <Text style={styles.mono}>{gps.coordenadas}</Text>
      {gps.precision && <Text style={styles.apagado}> {gps.precision}</Text>}
    </>
  );
}
