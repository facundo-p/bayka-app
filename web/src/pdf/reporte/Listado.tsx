import { Text, View } from '@react-pdf/renderer';
import { Gps, NombreConCodigo, RenglonEspecie } from '../arbol/PartesArbol';
import { TEXTO_ARBOL } from '../arbol/textosArbol';
import { Renglones } from '../plantilla/Renglones';
import type { FilaEnRenglones } from './renglonesReporte';
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

/**
 * Una sí y una no, sombreadas: guían la vista a lo largo de la fila. Mide lo
 * que su celda con más renglones; las demás quedan arriba.
 */
function FilaListado({ fila, sombreada }: { fila: FilaEnRenglones; sombreada: boolean }) {
  return (
    <View style={[styles.fila, sombreada ? styles.sombreada : {}]} wrap={false}>
      <Renglones renglones={fila.idArbol} style={[columna.idArbol, styles.idArbol]} />
      <RenglonEspecie especie={fila.especie} styles={styles} />
      <NombreConCodigo entidad={fila.parcela} style={columna.parcela} styles={styles} />
      <NombreConCodigo entidad={fila.grupo} style={columna.grupo} styles={styles} />
      <Text style={[columna.posicion, styles.centrado]}>{fila.posicion}</Text>
      <Text style={columna.registrado}>{fila.registrado}</Text>
      <Text style={columna.gps}>
        <Gps gps={fila.gps} styles={styles} />
      </Text>
    </View>
  );
}

/** Las filas de una hoja, debajo del encabezado de columnas. */
export function Listado({ filas }: { filas: readonly FilaEnRenglones[] }) {
  return (
    <View>
      <EncabezadoListado />
      {filas.map((fila, indice) => (
        <FilaListado key={indice} fila={fila} sombreada={indice % 2 === 1} />
      ))}
    </View>
  );
}
