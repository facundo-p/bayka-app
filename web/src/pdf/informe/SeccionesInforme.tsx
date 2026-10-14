import { Text, View } from '@react-pdf/renderer';
import { PORCENTAJE_COMPLETO } from '../../lib/formato';
import type { TextoEnRenglones } from '../plantilla/partirTexto';
import { Renglones } from '../plantilla/Renglones';
import { MEDIDA_INFORME } from '../plantilla/tokens';
import type { Indicador as DatosIndicador, IndicadorArboles, Indicadores } from './datosInforme';
import { informeStyles as styles } from './Informe.styles';
import type { FilaEspecieEnRenglones, InformeEnRenglones } from './renglonesInforme';
import { TEXTO_INFORME } from './textosInforme';

/** Ancho del relleno de una barra, de una fracción de 0 a 1. */
const anchoRelleno = (fraccion: number) => `${fraccion * PORCENTAJE_COMPLETO}%`;

export function Titulo({ linea }: { linea: TextoEnRenglones }) {
  return (
    <View style={styles.titulo} wrap={false}>
      <Text style={styles.tituloTexto}>{TEXTO_INFORME.documento}</Text>
      <Renglones renglones={linea} style={styles.linea} />
    </View>
  );
}

function IndicadorPrincipal({ arboles }: { arboles: IndicadorArboles }) {
  return (
    <View style={[styles.indicador, styles.indicadorPrincipal]}>
      <Text style={styles.rotulo}>{TEXTO_INFORME.arboles}</Text>
      <Text style={styles.valorIndicador}>
        {arboles.valor}
        {arboles.meta && <Text style={styles.meta}> {arboles.meta}</Text>}
      </Text>
      {arboles.avance !== null && (
        <View style={styles.barraAvance}>
          <View style={[styles.rellenoAvance, { width: anchoRelleno(arboles.avance) }]} />
        </View>
      )}
      {arboles.textoAvance && <Text style={styles.detalleIndicador}>{arboles.textoAvance}</Text>}
    </View>
  );
}

function Indicador({ rotulo, valor, detalle }: DatosIndicador) {
  return (
    <View style={styles.indicador}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valorIndicador}>{valor}</Text>
      <Text style={styles.detalleIndicador}>{detalle}</Text>
    </View>
  );
}

/** Los árboles siempre; a su derecha, los porcentajes elegidos. */
export function FilaIndicadores({ indicadores }: { indicadores: Indicadores }) {
  return (
    <View style={styles.indicadores} wrap={false}>
      <IndicadorPrincipal arboles={indicadores.arboles} />
      {indicadores.porcentajes.map((indicador) => (
        <Indicador key={indicador.rotulo} {...indicador} />
      ))}
    </View>
  );
}

/** Título de bloque: no queda solo al pie de una hoja. */
export function EncabezadoBloque({ children }: { children: string }) {
  return (
    <Text style={styles.encabezadoBloque} minPresenceAhead={MEDIDA_INFORME.presenciaTrasEncabezado}>
      {children}
    </Text>
  );
}

/** Mide lo que su nombre: el punto, la barra y los números van en el primer renglón. */
function RenglonEspecie({ fila }: { fila: FilaEspecieEnRenglones }) {
  return (
    <View style={styles.filaEspecie} wrap={false}>
      <View style={styles.nombreEspecie}>
        <View style={[styles.puntoFila, { backgroundColor: fila.color }]} />
        <Renglones renglones={fila.titulo} style={styles.tituloEspecie} />
      </View>
      <View style={styles.barraEspecie}>
        <View
          style={[
            styles.rellenoBarra,
            { width: anchoRelleno(fila.fraccion), backgroundColor: fila.color },
          ]}
        />
      </View>
      <Text style={styles.cantidad}>{fila.cantidad}</Text>
      <Text style={styles.porcentajeEspecie}>{fila.porcentaje}</Text>
    </View>
  );
}

export function BloqueEspecies({ especies }: { especies: InformeEnRenglones['especies'] }) {
  return (
    <View>
      <EncabezadoBloque>{especies.titulo}</EncabezadoBloque>
      {especies.vacio ? (
        <Text style={styles.mensaje}>{especies.vacio}</Text>
      ) : (
        especies.filas.map((fila) => <RenglonEspecie key={fila.codigo} fila={fila} />)
      )}
    </View>
  );
}
