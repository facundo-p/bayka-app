import { Text, View } from '@react-pdf/renderer';
import { PORCENTAJE_COMPLETO } from '../../lib/formato';
import { MEDIDA_INFORME } from '../plantilla/tokens';
import type {
  FilaEspecie,
  Indicador as DatosIndicador,
  IndicadorArboles,
  Indicadores,
  ModeloInforme,
} from './datosInforme';
import { informeStyles as styles } from './Informe.styles';
import { TEXTO_INFORME } from './textosInforme';

/** Ancho del relleno de una barra, de una fracción de 0 a 1. */
const anchoRelleno = (fraccion: number) => `${fraccion * PORCENTAJE_COMPLETO}%`;

export function Titulo({ linea }: { linea: string }) {
  return (
    <View style={styles.titulo} wrap={false}>
      <Text style={styles.tituloTexto}>{TEXTO_INFORME.documento}</Text>
      <Text style={styles.linea}>{linea}</Text>
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

function RenglonEspecie({ fila }: { fila: FilaEspecie }) {
  return (
    <View style={styles.filaEspecie} wrap={false}>
      <View style={styles.nombreEspecie}>
        <View style={[styles.punto, { backgroundColor: fila.color }]} />
        <Text style={styles.recortado}>{fila.titulo}</Text>
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

export function BloqueEspecies({ especies }: { especies: ModeloInforme['especies'] }) {
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
