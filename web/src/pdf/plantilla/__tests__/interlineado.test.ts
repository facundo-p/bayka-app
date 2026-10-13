import { informeStyles } from '../../informe/Informe.styles';
import { listadoStyles, tarjetaStyles } from '../../reporte/Reporte.styles';
import { ALTO_RENGLON_INFORME, ALTO_RENGLON_REPORTE } from '../tokens';

type Renglon = { fontSize?: number | string; lineHeight?: number | string };

const altoDibujado = ({ fontSize, lineHeight }: Renglon) => Number(fontSize) * Number(lineHeight);

const RENGLONES: [string, Renglon, number][] = [
  ['la línea del informe', informeStyles.linea, ALTO_RENGLON_INFORME.linea],
  ['la especie del informe', informeStyles.filaEspecie, ALTO_RENGLON_INFORME.fila],
  ['la leyenda del mapa', informeStyles.itemLeyenda, ALTO_RENGLON_INFORME.leyenda],
  ['la fila del listado', listadoStyles.fila, ALTO_RENGLON_REPORTE.fila],
  ['el ID de la tarjeta', tarjetaStyles.idArbol, ALTO_RENGLON_REPORTE.idTarjeta],
  ['la especie de la tarjeta', tarjetaStyles.nombreEspecie, ALTO_RENGLON_REPORTE.especieTarjeta],
  ['el dato de la tarjeta', tarjetaStyles.valor, ALTO_RENGLON_REPORTE.dato],
  ['el rótulo de la tarjeta', tarjetaStyles.rotulo, ALTO_RENGLON_REPORTE.etiqueta],
];

test.each(RENGLONES)('un renglón de %s mide lo que el plan le cuenta', (_, estilo, alto) => {
  expect(altoDibujado(estilo)).toBeCloseTo(alto);
});
