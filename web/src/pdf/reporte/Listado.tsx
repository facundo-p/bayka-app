import { Text, View } from '@react-pdf/renderer';
import { ConCodigo, Gps, RenglonEspecie } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import type { ModeloArbolReporte } from './datosReporte';
import { columnaListadoStyles as columna, listadoStyles as styles } from './Reporte.styles';

/** Cada hoja del listado es una página propia: el encabezado va explícito en todas. */
function EncabezadoListado() {
  const t = TEXTO_ARBOL;
  return (
    <View style={styles.encabezado}>
      <Text style={columna.idArbol}>{t.idArbol}</Text>
      <Text style={columna.especie}>{t.especie}</Text>
      <Text style={columna.parcela}>{t.parcela}</Text>
      <Text style={columna.grupo}>{t.grupo}</Text>
      <Text style={[columna.posicion, styles.centrado]}>{t.posicion}</Text>
      <Text style={columna.registrado}>{t.registrado}</Text>
      <Text style={columna.gps}>{t.gps}</Text>
    </View>
  );
}

/** Una sí y una no, sombreadas: guían la vista a lo largo de la fila. */
function FilaListado({ fila, sombreada }: { fila: ModeloArbolReporte; sombreada: boolean }) {
  return (
    <View style={[styles.fila, sombreada ? styles.sombreada : {}]} wrap={false}>
      <Text style={[columna.idArbol, styles.idArbol]}>{fila.idArbol}</Text>
      <RenglonEspecie especie={fila.especie} styles={styles} />
      <Text style={columna.parcela}>
        <ConCodigo entidad={fila.parcela} styles={styles} />
      </Text>
      <Text style={columna.grupo}>
        <ConCodigo entidad={fila.grupo} styles={styles} />
      </Text>
      <Text style={[columna.posicion, styles.centrado]}>{fila.posicion}</Text>
      <Text style={columna.registrado}>{fila.registrado}</Text>
      <Text style={columna.gps}>
        <Gps gps={fila.gps} styles={styles} />
      </Text>
    </View>
  );
}

/** Las filas de una hoja, debajo del encabezado de columnas. */
export function Listado({ filas }: { filas: readonly ModeloArbolReporte[] }) {
  return (
    <View>
      <EncabezadoListado />
      {filas.map((fila, indice) => (
        <FilaListado key={indice} fila={fila} sombreada={indice % 2 === 1} />
      ))}
    </View>
  );
}
