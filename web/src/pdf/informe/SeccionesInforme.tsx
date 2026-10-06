import { Text, View } from '@react-pdf/renderer';
import { PORCENTAJE_COMPLETO } from '../../lib/formato';
import { MEDIDA_INFORME } from '../plantilla/tokens';
import type {
  FilaEspecie,
  FilaParcela,
  IndicadorArboles,
  Indicadores,
  ModeloInforme,
  TotalParcelas,
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

type IndicadorProps = { rotulo: string; valor: string; detalle: string; alerta?: boolean };

function Indicador({ rotulo, valor, detalle, alerta = false }: IndicadorProps) {
  return (
    <View style={styles.indicador}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={[styles.valorIndicador, alerta ? styles.valorAlerta : undefined]}>{valor}</Text>
      <Text style={styles.detalleIndicador}>{detalle}</Text>
    </View>
  );
}

export function FilaIndicadores({ indicadores }: { indicadores: Indicadores }) {
  const { arboles, gps, foto, pendientes } = indicadores;
  return (
    <View style={styles.indicadores} wrap={false}>
      <IndicadorPrincipal arboles={arboles} />
      <Indicador rotulo={TEXTO_INFORME.conGps} {...gps} />
      <Indicador rotulo={TEXTO_INFORME.conFoto} {...foto} />
      <Indicador rotulo={TEXTO_INFORME.pendientes} {...pendientes} />
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
    <View style={styles.bloque}>
      <EncabezadoBloque>{especies.titulo}</EncabezadoBloque>
      {especies.vacio ? (
        <Text style={styles.mensaje}>{especies.vacio}</Text>
      ) : (
        especies.filas.map((fila) => <RenglonEspecie key={fila.codigo} fila={fila} />)
      )}
    </View>
  );
}

/** `fixed`: si la tabla sigue en otra hoja, el encabezado se repite arriba. */
function EncabezadoTabla() {
  const t = TEXTO_INFORME;
  return (
    <View style={styles.encabezadoTabla} wrap={false} fixed>
      <Text style={styles.celdaParcela}>{t.columnaParcela}</Text>
      <Text style={styles.celdaNumero}>{t.columnaGrupos}</Text>
      <Text style={styles.celdaNumero}>{t.columnaArboles}</Text>
      <View style={styles.celdaBarra} />
      <Text style={styles.celdaNumero}>{t.columnaPorcentaje}</Text>
    </View>
  );
}

function RenglonParcela({ fila }: { fila: FilaParcela }) {
  return (
    <View style={styles.filaTabla} wrap={false}>
      <Text style={styles.celdaParcela}>
        {fila.codigo && <Text style={styles.codigo}>{fila.codigo} </Text>}
        {fila.nombre}
      </Text>
      <Text style={styles.celdaNumero}>{fila.grupos}</Text>
      <Text style={styles.celdaNumero}>{fila.arboles}</Text>
      <View style={styles.celdaBarra}>
        <View style={styles.barraParcela}>
          <View style={[styles.rellenoParcela, { width: anchoRelleno(fila.fraccion) }]} />
        </View>
      </View>
      <Text style={styles.celdaNumero}>{fila.porcentaje}</Text>
    </View>
  );
}

function RenglonTotal({ total }: { total: TotalParcelas }) {
  return (
    <View style={[styles.filaTabla, styles.filaTotal]} wrap={false}>
      <Text style={styles.celdaParcela}>{total.titulo}</Text>
      <Text style={styles.celdaNumero}>{total.grupos}</Text>
      <Text style={styles.celdaNumero}>{total.arboles}</Text>
      <View style={styles.celdaBarra} />
      <Text style={styles.celdaNumero}>{total.porcentaje}</Text>
    </View>
  );
}

/** La fila Total no queda sola arriba de una hoja: viaja con la última parcela. */
function FinDeTabla({ ultima, total }: { ultima?: FilaParcela; total: TotalParcelas | null }) {
  return (
    <View wrap={false}>
      {ultima && <RenglonParcela fila={ultima} />}
      {total && <RenglonTotal total={total} />}
    </View>
  );
}

export function TablaParcelas({ parcelas }: { parcelas: ModeloInforme['parcelas'] }) {
  const anteriores = parcelas.filas.slice(0, -1);
  return (
    <View>
      <EncabezadoBloque>{TEXTO_INFORME.parcelas}</EncabezadoBloque>
      {parcelas.vacio ? (
        <Text style={styles.mensaje}>{parcelas.vacio}</Text>
      ) : (
        <View>
          <EncabezadoTabla />
          {anteriores.map((fila) => (
            <RenglonParcela key={fila.codigo ?? TEXTO_INFORME.sinParcela} fila={fila} />
          ))}
          <FinDeTabla ultima={parcelas.filas.at(-1)} total={parcelas.total} />
        </View>
      )}
    </View>
  );
}
